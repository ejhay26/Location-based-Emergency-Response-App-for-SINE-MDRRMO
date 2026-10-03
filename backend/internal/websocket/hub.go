package websocket

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/rs/zerolog/log"
)

// Client represents a connected WebSocket client
type Client struct {
	ID            string
	Conn          *websocket.Conn
	Subscriptions map[string]bool
	Mu            sync.Mutex
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	Clients    map[string]*Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan EventMessage
	Mu         sync.RWMutex
}

type EventMessage struct {
	Channel string
	Event   string
	Data    interface{}
}

type pusherInMessage struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type pusherSubscribeData struct {
	Channel string `json:"channel"`
	Auth    string `json:"auth"`
}

var GlobalHub *Hub

func InitHub() *Hub {
	h := &Hub{
		Clients:    make(map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan EventMessage, 256),
	}
	GlobalHub = h
	go h.run()
	return h
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.Register:
			h.Mu.Lock()
			h.Clients[client.ID] = client
			h.Mu.Unlock()
			log.Info().Str("client_id", client.ID).Msg("WebSocket client registered")

		case client := <-h.Unregister:
			h.Mu.Lock()
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				_ = client.Conn.Close()
			}
			h.Mu.Unlock()
			log.Info().Str("client_id", client.ID).Msg("WebSocket client unregistered")

		case msg := <-h.Broadcast:
			h.Mu.RLock()
			// Prepare pusher payload
			// e.g. {"channel":"emergencies","event":".EmergencyUpdated","data":{"action":"submitted","request_id":12}}
			payload := map[string]interface{}{
				"channel": msg.Channel,
				"event":   msg.Event,
				"data":    msg.Data,
			}
			bytes, err := json.Marshal(payload)
			if err != nil {
				h.Mu.RUnlock()
				continue
			}

			for _, client := range h.Clients {
				client.Mu.Lock()
				if client.Subscriptions[msg.Channel] {
					_ = client.Conn.WriteMessage(websocket.TextMessage, bytes)
				}
				client.Mu.Unlock()
			}
			h.Mu.RUnlock()
		}
	}
}

// BroadcastTo sends a real-time event to a specific channel
func BroadcastTo(channel, event string, data interface{}) {
	if GlobalHub != nil {
		GlobalHub.Broadcast <- EventMessage{
			Channel: channel,
			Event:   event,
			Data:    data,
		}
	}
}

// Helper methods for application domain events matching Laravel
func BroadcastEmergency(action string, requestId int) {
	BroadcastTo("emergencies", ".EmergencyUpdated", map[string]interface{}{
		"action":     action,
		"request_id": requestId,
	})
}

func BroadcastHazard(action string, hazardId int) {
	BroadcastTo("hazards", ".HazardUpdated", map[string]interface{}{
		"action":    action,
		"hazard_id": hazardId,
	})
}

func BroadcastMessage(action string, broadcastId int) {
	BroadcastTo("broadcasts", ".BroadcastMessageUpdated", map[string]interface{}{
		"action":       action,
		"broadcast_id": broadcastId,
	})
}

func BroadcastUser(action string, userId int) {
	BroadcastTo("users", ".UserVerified", map[string]interface{}{
		"action":  action,
		"user_id": userId,
	})
}

// Handler handles incoming WebSocket connections on /app/:app_key
func Handler() func(*websocket.Conn) {
	return func(c *websocket.Conn) {
		socketID := fmt.Sprintf("%d.%d", time.Now().UnixNano(), c.RemoteAddr())
		client := &Client{
			ID:            socketID,
			Conn:          c,
			Subscriptions: make(map[string]bool),
		}

		GlobalHub.Register <- client
		defer func() {
			GlobalHub.Unregister <- client
		}()

		// Send Pusher protocol connection_established handshake
		connData, _ := json.Marshal(map[string]interface{}{
			"socket_id":        socketID,
			"activity_timeout": 120,
		})
		initMsg, _ := json.Marshal(map[string]interface{}{
			"event": "pusher:connection_established",
			"data":  string(connData),
		})
		_ = c.WriteMessage(websocket.TextMessage, initMsg)

		for {
			msgType, rawMsg, err := c.ReadMessage()
			if err != nil {
				break
			}
			if msgType != websocket.TextMessage {
				continue
			}

			var in pusherInMessage
			if err := json.Unmarshal(rawMsg, &in); err != nil {
				continue
			}

			switch in.Event {
			case "pusher:ping":
				pong, _ := json.Marshal(map[string]interface{}{
					"event": "pusher:pong",
					"data":  map[string]interface{}{},
				})
				_ = c.WriteMessage(websocket.TextMessage, pong)

			case "pusher:subscribe":
				var sub pusherSubscribeData
				if err := json.Unmarshal(in.Data, &sub); err == nil && sub.Channel != "" {
					client.Mu.Lock()
					client.Subscriptions[sub.Channel] = true
					client.Mu.Unlock()

					ack, _ := json.Marshal(map[string]interface{}{
						"event":   "pusher_internal:subscription_succeeded",
						"channel": sub.Channel,
						"data":    map[string]interface{}{},
					})
					_ = c.WriteMessage(websocket.TextMessage, ack)
				}

			case "pusher:unsubscribe":
				var sub pusherSubscribeData
				if err := json.Unmarshal(in.Data, &sub); err == nil && sub.Channel != "" {
					client.Mu.Lock()
					delete(client.Subscriptions, sub.Channel)
					client.Mu.Unlock()
				}
			}
		}
	}
}
