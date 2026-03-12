const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5000;


const SUPABASE_URL = "https://exoxwnkwocaybyhewqdh.supabase.co";
const SUPABASE_KEY = "sb_publishable_05d_O3W3Ayg5XfYmnOAAtA_FFzq-CiD";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


const server = http.createServer(async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve frontend
  if (req.method === "GET" && req.url === "/") {
    const content = fs.readFileSync(path.join(__dirname, "public", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);
    return;
  }

  if (req.method === "GET" && req.url === "/style.css") {
    const content = fs.readFileSync(path.join(__dirname, "public", "style.css"));
    res.writeHead(200, { "Content-Type": "text/css" });
    res.end(content);
    return;
  }

  // Load messages
  if (req.method === "GET" && req.url.startsWith("/messages/")) {
    const parts = req.url.split("/");
    const user1 = decodeURIComponent(parts[2]);
    const user2 = decodeURIComponent(parts[3]);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender.eq.${user1},receiver.eq.${user2}),and(sender.eq.${user2},receiver.eq.${user1})`)
      .order("timestamp", { ascending: true });

    if (error) {
      res.writeHead(500);
      res.end(JSON.stringify(error));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  // Send message
  if (req.method === "POST" && req.url === "/messages") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      const { senderId, receiverId, content } = JSON.parse(body);

      const { data, error } = await supabase
        .from("messages")
        .insert([{ sender: senderId, receiver: receiverId, content }])
        .select()
        .single();

      if (error) {
        res.writeHead(500);
        res.end(JSON.stringify(error));
        return;
      }

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

