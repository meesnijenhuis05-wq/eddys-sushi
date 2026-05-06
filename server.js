const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Bestellingen in geheugen opslaan (voor schoolproject)
const orders = {};

// Demo bestelling alvast aanmaken zodat tracking direct werkt
orders['DEMO01'] = {
  id: 'DEMO01',
  customerName: 'Demo Klant',
  type: 'afhalen',
  status: 0,
  createdAt: new Date().toISOString(),
  delay: null
};

function generateOrderId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Tracking pagina
app.get('/track/:orderId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Nieuwe bestelling aanmaken
app.post('/api/order', (req, res) => {
  const { customerName, type } = req.body;
  const orderId = generateOrderId();
  orders[orderId] = {
    id: orderId,
    customerName: customerName || 'Klant',
    type: type || 'afhalen', // 'afhalen' of 'bezorging'
    status: 0,               // 0=ontvangen, 1=bereiding, 2=klaar/onderweg, 3=voltooid
    createdAt: new Date().toISOString(),
    delay: null
  };
  res.json({ orderId, trackingUrl: `/track/${orderId}` });
});

// API: Bestelling ophalen
app.get('/api/order/:orderId', (req, res) => {
  const order = orders[req.params.orderId];
  if (!order) return res.status(404).json({ error: 'Bestelling niet gevonden' });
  res.json(order);
});

// API: Alle bestellingen (voor admin)
app.get('/api/orders', (req, res) => {
  res.json(Object.values(orders));
});

// Realtime via Socket.io
io.on('connection', (socket) => {
  // Klant sluit aan op zijn bestelling
  socket.on('join-order', (orderId) => {
    socket.join(`order-${orderId}`);
    if (orders[orderId]) {
      socket.emit('order-update', orders[orderId]);
    }
  });

  // Admin sluit aan
  socket.on('join-admin', () => {
    socket.join('admin');
    socket.emit('orders-update', Object.values(orders));
  });

  // Status bijwerken
  socket.on('update-status', ({ orderId, status }) => {
    if (orders[orderId] !== undefined) {
      orders[orderId].status = status;
      orders[orderId].delay = null; // vertraging wissen bij statuswijziging
      io.to(`order-${orderId}`).emit('order-update', orders[orderId]);
      io.to('admin').emit('orders-update', Object.values(orders));
    }
  });

  // Vertraging melden
  socket.on('send-delay', ({ orderId, minutes }) => {
    if (orders[orderId] !== undefined) {
      orders[orderId].delay = parseInt(minutes);
      io.to(`order-${orderId}`).emit('order-update', orders[orderId]);
      io.to(`order-${orderId}`).emit('delay-notification', { minutes: parseInt(minutes) });
      io.to('admin').emit('orders-update', Object.values(orders));
    }
  });

  // Review verzoek sturen
  socket.on('review-verzoek', ({ orderId }) => {
    io.to(`order-${orderId}`).emit('review-verzoek');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🍣  Eddy's Sushi Tracking System`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐  App:    http://localhost:${PORT}`);
  console.log(`👨‍🍳  Admin:  http://localhost:${PORT}/admin`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
