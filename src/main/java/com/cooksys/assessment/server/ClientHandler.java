package com.cooksys.assessment.server;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.Socket;
import java.net.SocketException;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.cooksys.assessment.model.Message;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class ClientHandler implements Runnable {
	private Logger log = LoggerFactory.getLogger(ClientHandler.class);
	
	private Socket socket;
	private ObjectMapper mapper;
	private BufferedReader reader;
	private PrintWriter writer;
	
	private String username;
	private String mostRecentCommand;
	private String mostRecentRecipient;

	private Map<String, ClientHandler> clientConnections;

	public ClientHandler(Socket socket, Map<String, ClientHandler> clientConnections) {
		super();
		this.socket = socket;
		this.clientConnections = clientConnections;
		this.mostRecentCommand = "default";
		this.mostRecentRecipient = "";
	}

	// ClientHandler thread spawned by Server
	// This handles and processes input from the client until the socket closes
	public void run() {
		try {
			mapper = new ObjectMapper();
			reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
			writer = new PrintWriter(new OutputStreamWriter(socket.getOutputStream()));
			
			while (!socket.isClosed()) {
				String raw = reader.readLine();
				Message message = mapper.readValue(raw, Message.class);

				switch (message.getCommand()) {
					case "connect":
						mostRecentRecipient = "";
						connectCommand(message);
						break;
					case "help":
						outputMessage(message);
						break;
					case "echo":
						mostRecentRecipient = "";
						mostRecentCommand = message.getCommand();
						echoCommand(message);
						break;
					case "@":
						mostRecentRecipient = "";
						mostRecentCommand = message.getCommand();
						directMessageCommand(message);
						break;
					case "broadcast":
						mostRecentRecipient = "";
						mostRecentCommand = message.getCommand();
						broadcastCommand(message);
						break;
					case "users":
						usersCommand(message);
						break;
					case "error":
						outputMessage(message);
						break;
					case "disconnect":
					case "exit":
					case "quit":
						disconnectCommand(message);
						break;
					default:
						executeMostRecentCommand(message);
						break;
				}
			}

			reader.close();
			writer.close();
		} catch (SocketException socketException) {
			log.error("Client <" + username + "> disconnected unexpectedly!", socketException);
			try {
				reader.close();
			} catch (IOException readerError) {
				log.error("Error trying to close reader!", readerError);
				readerError.printStackTrace();
			}
			writer.close();
		} catch (IOException ioException) {
			log.error("Error sending message through connection to " + username, ioException);
			try {
				reader.close();
			} catch (IOException readerError) {
				log.error("Error trying to close reader!", readerError);
				readerError.printStackTrace();
			}
			writer.close();
			ioException.printStackTrace();
		}
	}

	// Getter method for ClientHandler
	public String getUsername() {
		return username;
	}
	
	// Outputs the received message to this client
	public synchronized void outputMessage(Message message) {
		if(!socket.isClosed()) {
			try {
				String userListResponse = mapper.writeValueAsString(message);
				writer.write(userListResponse);
				writer.flush();
			} catch (JsonProcessingException e) {
				log.error("Error in client handler: ", e);
			}
		}
	}

	// Connects the client to the server and sends back an alert
	// If the client has the same name as an existing client we 
	//modify their name and notify all clients
	private void connectCommand(Message message) {
		log.info("user <{}> connected", message.getUsername());
		username = message.getUsername();
		
		if(clientConnections.get(username) != null) {
			username = new String(username + "'s_clone");
			message.setUsername(username);
		}
		clientConnections.put(username, this);
		
		message.setCommand("alert");
		message.setContents("");
		clientConnections.values().forEach(client -> {
			if(client != null) {
				client.outputMessage(message);
			}
		});
	}

	// Echos the received message back to the client
	private void echoCommand(Message message) {
		log.info("user <{}> echoed message: <{}>", message.getUsername(), message.getContents());
		outputMessage(message);
	}

	// Handles private messaging from client to client
	private void directMessageCommand(Message message) {
		boolean foundRecipient = false;
		StringBuffer messageDeconstructor = new StringBuffer("");
		ClientHandler recipientHandler = null;

		if(mostRecentRecipient.isEmpty()) {
			for(int i = 0; i < message.getContents().length(); i++) {
				if(message.getContents().charAt(i) != ' ' || foundRecipient) {
					messageDeconstructor.append(message.getContents().charAt(i));
				} else {
					mostRecentRecipient = messageDeconstructor.toString();
					messageDeconstructor = new StringBuffer("");
					foundRecipient = true;
				}
			}
			
			if(mostRecentRecipient.isEmpty()) {
				mostRecentRecipient = messageDeconstructor.toString();
				messageDeconstructor = new StringBuffer("");
				foundRecipient = true;
			}
			
			message.setContents(messageDeconstructor.toString());
		}
		
		log.info("user <{}> sent a message to <{}>: <{}>", message.getUsername(), mostRecentRecipient, message.getContents());
		
		foundRecipient = false;
		if(clientConnections.get(mostRecentRecipient.toString()) != null) {
			foundRecipient = true;
			recipientHandler = clientConnections.get(mostRecentRecipient.toString());
		}
		
		if(foundRecipient) {
			recipientHandler.outputMessage(message);
		} else {
			message.setContents("The user <" + mostRecentRecipient + "> is not currently connected!");
			message.setCommand("error");
			outputMessage(message);
		}
	}

	// Allows clients to broadcast commands to all other clients connected to the server
	private void broadcastCommand(Message message) {
		log.info("user <{}> broadcasted: <{}>", message.getUsername(), message.getContents());
		
		clientConnections.values().forEach(client -> {
			if(client != null) {
				client.outputMessage(message);
			}
		});
	}

	// Sends a lit of all connected clients back to the client
	private void usersCommand(Message message) {
		log.info("user <{}> queried for a list of users", message.getUsername());
		
		StringBuffer usernameListBuilder = new StringBuffer("${cli.chalk.cyan.bold(getCurrentTime())} ${cli.chalk.bold('Online Users: ')}");
		clientConnections.values().forEach(client -> {
			usernameListBuilder.append("\n              <" + client.getUsername() + ">");
		});
		
		message.setContents(usernameListBuilder.toString());
		
		outputMessage(message);
	}

	// Handles disconnecting the user and closing the socket
	private void disconnectCommand(Message message) throws IOException {
		log.info("user <{}> disconnected", message.getUsername());
		
		message.setContents("");
		clientConnections.values().forEach(client -> {
			if(client != null) {
				client.outputMessage(message);
			}
		});
		
		clientConnections.remove(message.getUsername());
		this.socket.close();
	}

	// Handles illegal commands or unknown recipients
	private void noPreviousCommand(Message message) throws IOException {
		message.setContents("Illegal Command or Unknown Recipient: " + message.getContents());
		outputMessage(message);
	}

	// IF the command send is not recognized then the server tries to apply the most recent command used
	public void executeMostRecentCommand(Message message) throws IOException {
		switch(mostRecentCommand) {
			case "broadcast":
				message.setCommand("broadcast");
				broadcastCommand(message);
				break;
			case "echo":
				message.setCommand("echo");
				echoCommand(message);
				break;
			case "@":
				message.setCommand("@");
				directMessageCommand(message);
				break;
			default:
				noPreviousCommand(message);
				break;
		}
	}
}
