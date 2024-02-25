import http from "http";
import net from "net";
import url from "url";

// Importing a CommonJS module into an ES module
const dotenv = await import('dotenv');
const { config } = dotenv.default;

// Load environment variables from .env
config();

const handleClientRequest = (client_request, client_response) => {
  //Handling client requests
  const client_http_url = url.parse(client_request.url, true);
  if (client_http_url.hostname && client_request.method) {
    console.log(
      "ALLOWED",
      client_request.method,
      `|${client_http_url.hostname}`,
    );
    const options = {
      hostname: client_http_url.hostname,
      port: 80,
      path: client_http_url.pathname,
      method: client_request.method,
      headers: client_request.headers,
    };

    //Handling Server Response
    const server_request = http.request(options, (server_response) => {
      client_response.writeHead(
        server_response.statusCode,
        server_response.headers,
      );
      server_response.pipe(client_response, { end: true });
      client_request.pipe(server_request, { end: true });
    });

    //Server Error Logs
    server_request.on("error", (error) => {
      console.error("ERROR | HTTP server request error:", error.message);
    });

    //Client Error Logs
    client_request.on("error", (error) => {
      console.error("ERROR | HTTP client request error:", error.message);
    });
  }
};

const handleConnectRequest = (request, client_socket) => {
  //Handling client requests
  const { port, hostname } = url.parse(`//${request.url}`, false, true);
  if (hostname && port) {
    const server_socket = net.connect(port, hostname);

    //Handling Server Response
    server_socket.on("connect", () => {
      console.log("ALLOWED", request.method, `|${hostname}`);
      client_socket.write(
        ["HTTP/1.1 200 Connection Established", "Proxy-agent: zeoxy"].join(
          "\r\n",
        ),
      );
      client_socket.write("\r\n\r\n");
      server_socket.pipe(client_socket, { end: true });
      client_socket.pipe(server_socket, { end: true });
    });

    server_socket.on("close", () => {
      client_socket.end();
      client_socket.destroy();
    });

    server_socket.on("error", (error) => {
      console.error("ERROR | Server socket error:", error.message);
      client_socket.end();
      client_socket.destroy();
    });

    client_socket.on("close", () => {
      server_socket.end();
      server_socket.destroy();
    });

    client_socket.on("error", (error) => {
      console.error("ERROR | Client socket error:", error.message);
      server_socket.end();
      server_socket.destroy();
    });
  } else {
    client_socket.end();
    client_socket.destroy();
  }
};

const startProxyServer = (port) => {
  //Creates a Proxy Server for HTTP Connection.
  const proxy_server = http.createServer((client_request, client_response) => {
    handleClientRequest(client_request, client_response);
  });

  //Creates a Proxy Server for HTTPS Connection.
  proxy_server.on("connect", (request, client_socket) => {
    handleConnectRequest(request, client_socket);
  });

  //Logs Proxy Details
  const proxy_server_listener = proxy_server.listen(port, (error) => {
    if (error) {
      console.error("ERROR | Proxy server listener error:", error.message);
    } else {
      const listener_local_ip = proxy_server_listener.address();
      console.log(
        `Nodejs Proxy Server running on port: ${listener_local_ip.port}`,
      );
      console.log("================================================");
      console.log("STATUS", "METHOD", "|URL");
      console.log("================================================");
    }
  });

  //Handling the SIGINT Signal
  process.on("SIGINT", () => {
    console.log();
    console.log("SIGINT signal received. Closing the server.");
    proxy_server.close((error) => {
      if (error) {
        console.error("ERROR | Error closing server:", error.message);
        process.exit(1);
      } else {
        console.log("Closed the server.");
        process.exit(0);
      }
    });
  });
};

try {
  //Start the Proxy Server
  const PORT = process.env.PORT;
  startProxyServer(PORT);
} catch (error) {
  console.error("ERROR | Failed to start proxy server:", error.message);
  process.exit(1);
}
