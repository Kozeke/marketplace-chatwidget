from fastapi import FastAPI, HTTPException,  WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
import os
from typing import List, Optional,Dict
from datetime import datetime
from pydantic import ValidationError

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["chatwidget"]



# from transformers import pipeline, DistilBertForSequenceClassification, DistilBertTokenizer

# model = DistilBertForSequenceClassification.from_pretrained("./fine_tune_model")
# tokenizer = DistilBertTokenizer.from_pretrained("./fine_tune_model")


# # Load the fine-tuned model and tokenizer
# from transformers import pipeline

# classifier = pipeline(
#     "text-classification",
#     model=model,
#     tokenizer=tokenizer
# )

# class TextInput(BaseModel):
#     text: str
    
# @app.post("/predict")
# async def predict(input_data: TextInput):
#     try:
#         # Extract text from request body
#         text = input_data.text
#         # Tokenize input
#         inputs = tokenizer(text, return_tensors="np", truncation=True, padding=True)
#         input_ids = inputs["input_ids"]
#         attention_mask = inputs["attention_mask"]

#         # Run inference
#         outputs = session.run(None, {"input_ids": input_ids, "attention_mask": attention_mask})[0]
#         predicted_intent = intent_map[np.argmax(outputs, axis=1)[0]]

#         return {"intent": predicted_intent}
#     except Exception as e:
#         return {"error": f"Prediction failed: {str(e)}"}


# WebSocket connections
connected_clients: Dict[str, WebSocket] = {}  # userId -> WebSocket
connected_agents: Dict[str, WebSocket] = {}  # agentId -> WebSocket

# Define a POST endpoint for intent classification
from fastapi import FastAPI
from pydantic import BaseModel
import spacy
from transformers import pipeline

nlp = spacy.load("en_core_web_sm")  # Should now load without error
classifier = pipeline("text-classification", model="multi_intent_model", tokenizer="multi_intent_model")

# Label mapping
inverse_label_map = {0: "search_product", 1: "place_order", 2: "track_order"}

class TextInput(BaseModel):
    text: str

@app.post("/classify-intent")
async def classify_intent(input: TextInput):
    # Classify intent
    result = classifier(input.text.lower())[0]  # Returns list of scores for each label
    intents = [
        {"intent": inverse_label_map[i], "confidence": score["score"]}
        for i, score in enumerate(result) if score["score"] > 0.5
    ]

    # Entity extraction
    doc = nlp(input.text.lower())
    is_cheapest = "cheapest" in input.text.lower()
    brand = "Sony"  # Default brand
    category = "headphone"  # Default category
    for token in doc:
        if token.pos_ == "NOUN" and token.text not in ["cheapest", "expensive"]:
            category = token.text  # Extract last noun as category
        if token.ent_type_ == "ORG":
            brand = token.text  # Extract brand if recognized

    return {
        "intents": intents,  # Return list of intents with confidences
        "params": {
            "brand": brand,
            "category": category,
            "sort": "price_asc" if is_cheapest else "price_desc"
        }
    }

# Agent Endpoints
@app.post("/agents")
async def create_agent(agent: dict):
    db.agents.update_one(
        {"websiteId": agent["websiteId"], "intent": agent["intent"]},
        {"$set": agent},
        upsert=True
    )
    return {"status": "Agent created"}

@app.get("/agents")
async def get_agents(websiteId: str, intent: str = None):
    query = {"websiteId": websiteId}
    if intent:
        query["intent"] = intent
    agents = list(db.agents.find(query, {"_id": 0}))
    return {"agents": agents}

# Chain Endpoints
@app.post("/chains")
async def create_chain(chain: dict):
    if not chain.get("websiteId") or not chain.get("chainId") or not chain.get("agentSequence"):
        raise HTTPException(status_code=400, detail="Missing required fields")
    db.chains.update_one(
        {"websiteId": chain["websiteId"], "chainId": chain["chainId"]},
        {"$set": chain},
        upsert=True
    )
    return {"status": "Chain created"}

@app.get("/chains")
async def get_chains(websiteId: str):
    chains = list(db.chains.find({"websiteId": websiteId}, {"_id": 0}))
    return {"chains": chains}

# Widget Settings Models
class ReadyQuestion(BaseModel):
    label: str
    query: str

class WidgetSettings(BaseModel):
    primaryColor: str = "#3b82f6"
    backgroundColor: str = "#ffffff"
    textColor: str = "#000000"
    logoUrl: str = "/img/logo/logo.jpg"
    font: str = "Arial"
    fontSize: str = "16px"
    position: str = "bottom-right"
    isCollapsed: bool = True
    welcomeMessage: str = "Welcome to our support chat!"
    readyQuestions: List[ReadyQuestion] = [
        ReadyQuestion(label="Cheapest headphones", query="cheapest headphones"),
        ReadyQuestion(label="Order status", query="order status"),
    ]
    showClearChat: bool = True
    showAddToCart: bool = True
    defaultWidth: int = 400
    defaultHeight: int = 500
    title: str = "Zipper Bot"
    enableLiveChat: bool = True
    liveChatHours: Optional[Dict[str, str]] = {"start": "09:00", "end": "17:00", "timezone": "UTC"}

class AgentStatus(BaseModel):
    agentId: str
    status: str

class ChatMessage(BaseModel):
    sender: str  # "user", "agent"
    text: str
    timestamp: str = datetime.utcnow().isoformat()

class ChatSession(BaseModel):
    sessionId: str
    clientId: str
    userId: str
    agentId: Optional[str] = None
    status: str = "pending"  # "pending", "active", "closed"
    messages: List[ChatMessage] = []

class HumanAgent(BaseModel):
    websiteId: str
    agentId: str
    name: str
    email: str
    status: str = "offline"
    lastActive: Optional[str] = None

# Human Agent Endpoints (uses `humanAgents` collection)
@app.post("/human-agents")
async def create_human_agent(agent: HumanAgent):
    db.humanAgents.update_one(
        {"websiteId": agent.websiteId, "agentId": agent.agentId},
        {"$set": agent.dict()},
        upsert=True
    )
    return {"status": "Human agent created"}

@app.get("/human-agents")
async def get_human_agents(websiteId: str, agentId: str = None):
    query = {"websiteId": websiteId}
    if agentId:
        query["agentId"] = agentId
    agents = list(db.humanAgents.find(query, {"_id": 0}))
    return {"agents": agents}

@app.post("/human-agents/status")
async def update_human_agent_status(status: AgentStatus):
    db.humanAgents.update_one(
        {"agentId": status.agentId},
        {"$set": {"status": status.status, "lastActive": datetime.utcnow().isoformat()}},
    )
    return {"status": "Human agent status updated"}

@app.get("/human-agents/available")
async def get_available_human_agents(websiteId: str):
    agents = list(db.humanAgents.find({"websiteId": websiteId, "status": "online"}, {"_id": 0}))
    return {"agents": agents}


# Widget Settings Endpoints
@app.get("/widget/{clientId}")
async def get_widget_settings(clientId: str):
    settings = db.widgetSettings.find_one({"clientId": clientId}, {"_id": 0})
    
    if not settings:
        # Create default settings inside `widgetSettings`
        default_settings = WidgetSettings().dict()
        full_document = {
            "clientId": clientId,
            "widgetSettings": default_settings
        }
        db.widgetSettings.insert_one(full_document)
        return full_document

    return settings


@app.post("/widget/{clientId}")
async def update_widget_settings(clientId: str, settings: WidgetSettings):
    # Validate inputs to prevent XSS or invalid data
    if not all(isinstance(q.label, str) and isinstance(q.query, str) for q in settings.readyQuestions):
        raise HTTPException(status_code=400, detail="Invalid ready questions format")
    if not settings.logoUrl.startswith(("http://", "https://", "/")):
        raise HTTPException(status_code=400, detail="Invalid logo URL")

    updated_settings = settings.dict()

    db.widgetSettings.update_one(
        {"clientId": clientId},
        {"$set": {
            "clientId": clientId,
            "widgetSettings": updated_settings
        }},
        upsert=True
    )

    return {"status": "Widget settings updated"}


# Chat Session Endpoints
@app.post("/chat/session")
async def create_chat_session(session: ChatSession):
    session_dict = session.dict()
    session_dict["createdAt"] = datetime.utcnow().isoformat()
    session_dict["updatedAt"] = session_dict["createdAt"]
    db.chat_sessions.insert_one(session_dict)
    return {"sessionId": session.sessionId}

@app.get("/chat/session")
async def list_chat_sessions(agentId: str, clientId: str):
    sessions = list(db.chat_sessions.find(
        {"agentId": agentId, "clientId": clientId},
        {"_id": 0}
    ))
    return {"sessions": sessions}


class CloseSessionRequest(BaseModel):
    session_id: str

@app.post("/chat/session/close")
async def close_session(request: CloseSessionRequest):
    session_id = request.session_id
    session = db.chat_sessions.find_one({"sessionId": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.chat_sessions.update_one(
        {"sessionId": session_id},
        {"$set": {"status": "closed", "agentId": None, "updatedAt": datetime.utcnow().isoformat()}}
    )

    user_ws = connected_clients.get((session["clientId"], session["userId"]))
    if user_ws:
        await user_ws.send_json({
            "message": {
                "sender": "bot",
                "text": "Live chat ended.",
                "timestamp": datetime.utcnow().isoformat()
            }
        })

    return {"message": "Session closed"}


# @app.websocket("/ws/chat/{clientId}/{userId}")
# async def websocket_user_endpoint(websocket: WebSocket, clientId: str, userId: str):
#     await websocket.accept()
#     connected_clients[(clientId, userId)] = websocket
#     try:
#         while True:
#             data = await websocket.receive_json()
#             try:
#                 if not isinstance(data, dict) or "sessionId" not in data or "message" not in data:
#                     await websocket.send_json({"error": "Invalid message format: sessionId and message required"})
#                     continue
#                 session_id = data["sessionId"]
#                 message = ChatMessage(**data["message"])
#             except ValidationError as e:
#                 await websocket.send_json({"error": f"Invalid message format: {str(e)}"})
#                 continue
#             except KeyError as e:
#                 await websocket.send_json({"error": f"Missing field: {str(e)}"})
#                 continue

#             session = db.chat_sessions.find_one({"sessionId": session_id})
#             if not session:
#                 await websocket.send_json({"error": "Session not found"})
#                 continue

#             # Save message to session
#             new_message = message.dict()
#             db.chat_sessions.update_one(
#                 {"sessionId": session_id},
#                 {"$push": {"messages": new_message}, "$set": {"updatedAt": datetime.utcnow().isoformat()}}
#             )

#             # Handle human assistance request
#             if message.text == "human_assistance":
#                 print("clientId", clientId)
#                 agents = list(db.humanAgents.find({"websiteId": clientId, "status": "online"}, {"_id": 0}))
#                 if not agents:
#                     print("no agents found")
#                     await websocket.send_json({"message": {"sender": "bot", "text": "No specialists available. Please try again later.", "timestamp": datetime.utcnow().isoformat()}})
#                     continue
#                 agent = agents[0]  # Simple routing: pick first available
#                 db.chat_sessions.update_one(
#                     {"sessionId": session_id},
#                     {"$set": {"agentId": agent["agentId"], "status": "active", "updatedAt": datetime.utcnow().isoformat()}}
#                 )
#                 # Notify client of agent assignment
#                 await websocket.send_json({"agentAssigned": True, "message": {"sender": "bot", "text": "Connecting you to a specialist...", "timestamp": datetime.utcnow().isoformat()}})
#                 # Notify agent
#                 agent_ws = connected_agents.get(agent["agentId"])
#                 if agent_ws:
#                     await agent_ws.send_json({"sessionId": session_id, "message": {"sender": "user", "text": "User requested assistance", "timestamp": datetime.utcnow().isoformat()}})
#             else:
#                 # Forward message to assigned agent
#                 print("agentId", session.get("agentId"))
#                 if session.get("agentId"):
#                     agent_ws = connected_agents.get(session["agentId"])
#                     print("connected agents", connected_agents.get(session["agentId"]), connected_agents)
#                     if agent_ws:
#                         await agent_ws.send_json({"sessionId": session_id, "message": new_message})
#                     else:
#                         await websocket.send_json({"message": {"sender": "bot", "text": "Specialist is unavailable.", "timestamp": datetime.utcnow().isoformat()}})
#                 else:
                    # Handle with bot using intent classifier
                    # intent_result = classifier(message.text)
                    # if intent_result[0]["label"] == "human_assistance" or intent_result[0]["score"] < 0.7:
                    #     agents = list(db.humanAgents.find({"websiteId": clientId, "status": "online"}, {"_id": 0}))
                    #     if agents:
                    #         agent = agents[0]
                    #         db.chat_sessions.update_one(
                    #             {"sessionId": session_id},
                    #             {"$set": {"agentId": agent["agentId"], "status": "active", "updatedAt": datetime.utcnow().isoformat()}}
                    #         )
                    #         await websocket.send_json({"agentAssigned": True, "message": {"sender": "bot", "text": "Connecting you to a specialist...", "timestamp": datetime.utcnow().isoformat()}})
                    #         agent_ws = connected_agents.get(agent["agentId"])
                    #         if agent_ws:
                    #             await agent_ws.send_json({"sessionId": session_id, "message": new_message})
                    #     else:
                    #         await websocket.send_json({"message": {"sender": "bot", "text": "No specialists available. Please try again later.", "timestamp": datetime.utcnow().isoformat()}})
                    # else:
                    #     await websocket.send_json({"message": {"sender": "bot", "text": f"Bot response for intent: {intent_result[0]['label']}", "timestamp": datetime.utcnow().isoformat()}})
    # except WebSocketDisconnect:
    #     del connected_clients[(clientId, userId)]

@app.websocket("/ws/agent/{agentId}")
async def websocket_agent_endpoint(websocket: WebSocket, agentId: str):
    await websocket.accept()
    connected_agents[agentId] = websocket
    try:
        while True:
            data = await websocket.receive_json()
            try:
                if not isinstance(data, dict) or "sessionId" not in data or "message" not in data:
                    await websocket.send_json({"error": "Invalid message format: sessionId and message required"})
                    continue
                session_id = data["sessionId"]
                message = ChatMessage(**data["message"])
            except ValidationError as e:
                await websocket.send_json({"error": f"Invalid message format: {str(e)}"})
                continue
            except KeyError as e:
                await websocket.send_json({"error": f"Missing field: {str(e)}"})
                continue

            session = db.chat_sessions.find_one({"sessionId": session_id})
            if not session:
                await websocket.send_json({"error": "Session not found"})
                continue

            # Save message
            new_message = message.dict()
            db.chat_sessions.update_one(
                {"sessionId": session_id},
                {"$push": {"messages": new_message}, "$set": {"updatedAt": datetime.utcnow().isoformat()}}
            )

            # Send to user
            user_ws = connected_clients.get((session["clientId"], session["userId"]))
            if user_ws:
                await user_ws.send_json({"message": new_message})
            else:
                await websocket.send_json({"error": "User not connected"})
    except WebSocketDisconnect:
        del connected_agents[agentId]
        db.humanAgents.update_one(
            {"agentId": agentId},
            {"$set": {"status": "offline", "lastActive": datetime.utcnow().isoformat()}}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)