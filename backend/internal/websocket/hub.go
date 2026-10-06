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

// WriteSafe writes a message to the WebSocket connection under the client's mutex
// with a 5-second write deadline to prevent slow-client stalls and race conditions.
func (c *Client) WriteSafe(msgType int, data []byte) error {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	_ = c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return c.Conn.WriteMessage(msgType, data)
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
			// Prepare pusher payload
			// e.g. {"channel":"emergencies","event":".EmergencyUpdated","data":{"action":"submitted","request_id":12}}
			payload := map[string]interface{}{
				"channel": msg.Channel,
				"event":   msg.Event,
				"data":    msg.Data,
			}
			bytes, err := json.Marshal(payload)
			if err != nil {
				continue
			}

			// Snapshot clients under RLock so network I/O never blocks the hub
			h.Mu.RLock()
			clients := make([]*Client, 0, len(h.Clients))
			for _, client := range h.Clients {
				clients = append(clients, client)
			}
			h.Mu.RUnlock()

			for _, client := range clients {
				client.Mu.Lock()
				subscribed := client.Subscriptions[msg.Channel]
				client.Mu.Unlock()
				if subscribed {
					_ = client.WriteSafe(websocket.TextMessage, bytes)
				}
			}
		}
	}
}

// BroadcastTo sends a real-time event to a specific channel without blocking the caller
func BroadcastTo(channel, event string, data interface{}) {
	if GlobalHub != nil {
		select {
		case GlobalHub.Broadcast <- EventMessage{
			Channel: channel,
			Event:   event,
			Data:    data,
		}:
		default:
			log.Warn().Str("channel", channel).Str("event", event).Msg("WebSocket broadcast queue full, dropped message")
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

// Handler handles incoming WebSocket connections on /ws and /app/:app_key
func Handler() func(*websocket.Conn) {
	return func(c *websocket.Conn) {
		socketID := fmt.Sprintf("%d.%d", time.Now().UnixNano(), time.Now().UnixNano()%100000000)
		client := &Client{
			ID:   socketID,
			Conn: c,
			Subscriptions: map[string]bool{
				"emergencies": true,
				"hazards":     true,
				"broadcasts":  true,
				"users":       true,
			},
		}

		GlobalHub.Register <- client
		defer func() {
			GlobalHub.Unregister <- client
		}()

		// Send native WebSocket connected handshake
		nativeConnMsg, _ := json.Marshal(map[string]interface{}{
			"event": "connected",
			"data": map[string]interface{}{
				"status":    "ok",
				"socket_id": socketID,
			},
		})
		_ = client.WriteSafe(websocket.TextMessage, nativeConnMsg)

		// Send Pusher protocol connection_established handshake for legacy clients
		connData, _ := json.Marshal(map[string]interface{}{
			"socket_id":        socketID,
			"activity_timeout": 120,
		})
		pusherInitMsg, _ := json.Marshal(map[string]interface{}{
			"event": "pusher:connection_established",
			"data":  string(connData),
		})
		_ = client.WriteSafe(websocket.TextMessage, pusherInitMsg)

		for {
			msgType, rawMsg, err := c.ReadMessage()
			if err != nil {
				break
			}
			if msgType != websocket.TextMessage {
				continue
			}

			// Inbound message structure accommodating native and Pusher frames
			var in struct {
				Action   string          `json:"action"`
				Event    string          `json:"event"`
				Channel  string          `json:"channel"`
				Channels []string        `json:"channels"`
				Data     json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(rawMsg, &in); err != nil {
				continue
			}

			// Heartbeat: native ping or Pusher ping
			if in.Action == "ping" || in.Event == "pusher:ping" {
				pong, _ := json.Marshal(map[string]interface{}{
					"action": "pong",
					"event":  "pusher:pong",
					"data":   map[string]interface{}{},
				})
				_ = client.WriteSafe(websocket.TextMessage, pong)
				continue
			}

			// Channel subscription: native subscribe or Pusher subscribe
			if in.Action == "subscribe" || in.Event == "pusher:subscribe" {
				targetChannel := in.Channel
				if targetChannel == "" && len(in.Data) > 0 {
					var sub pusherSubscribeData
					if err := json.Unmarshal(in.Data, &sub); err == nil {
						targetChannel = sub.Channel
					}
				}

				client.Mu.Lock()
				if targetChannel != "" {
					client.Subscriptions[targetChannel] = true
				}
				for _, ch := range in.Channels {
					if ch != "" {
						client.Subscriptions[ch] = true
					}
				}
				client.Mu.Unlock()

				ack, _ := json.Marshal(map[string]interface{}{
					"action":  "subscribed",
					"event":   "pusher_internal:subscription_succeeded",
					"channel": targetChannel,
					"data":    map[string]interface{}{},
				})
				_ = client.WriteSafe(websocket.TextMessage, ack)
				continue
			}

			// Channel unsubscription
			if in.Action == "unsubscribe" || in.Event == "pusher:unsubscribe" {
				targetChannel := in.Channel
				if targetChannel == "" && len(in.Data) > 0 {
					var sub pusherSubscribeData
					if err := json.Unmarshal(in.Data, &sub); err == nil {
						targetChannel = sub.Channel
					}
				}

				client.Mu.Lock()
				if targetChannel != "" {
					delete(client.Subscriptions, targetChannel)
				}
				for _, ch := range in.Channels {
					delete(client.Subscriptions, ch)
				}
				client.Mu.Unlock()
				continue
			}
		}
	}
}
