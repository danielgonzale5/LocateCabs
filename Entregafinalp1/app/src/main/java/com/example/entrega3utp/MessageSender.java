package com.example.entrega3utp;

import android.os.AsyncTask;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class MessageSender extends AsyncTask<String, Void, Void> {


    public DatagramSocket socket;


    protected Void doInBackground(String...voids) {
        String message = voids[0];
        String direct = voids[1];

        try {
            socket = new DatagramSocket();
            DatagramPacket packet = new DatagramPacket(message.getBytes(StandardCharsets.UTF_8), message.length(), InetAddress.getByName(direct), 3020);
            socket.send(packet);
            socket.close();

        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }


}

