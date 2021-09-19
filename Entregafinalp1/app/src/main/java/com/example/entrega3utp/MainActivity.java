package com.example.entrega3utp;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.provider.Settings;

import android.widget.EditText;
import android.widget.Switch;
import android.widget.TextView;


import java.io.IOException;

import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    TextView mensaje1; //especificamos que vamos a usar un objeto de la clase textview para que la app pueda escribir en el
    TextView mensaje2;
    EditText numip;   // especificamos que vamos a usar un objeto de la clase EditText para que podamos escribir en el
    Switch estado ;


    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        mensaje1 = (TextView) findViewById(R.id.mensaje_id);
        mensaje2 = (TextView) findViewById(R.id.mensaje_id2);

        //el siguiente if comprueba si se ha dado el permiso gps de ejecucion o no

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION,}, 1000);
        } else { locationStart(); }

        //en java lo siguiente se llama casting el cual es un objeto que se pasa a otro y que concerva la herencia .
        numip = (EditText) findViewById(R.id.num);  //Debemos buscar el objeto por medio de una Id y nos ayuda la clase R y nos sirve como puente de comunicación .
        estado = findViewById(R.id.switch1);


    }



    private void locationStart() { //Este metodo no retorna ni intercambia informacion por el private . Por lo cual solo funciona para encapsular la información.
        LocationManager mlocManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        Localizacion Local = new Localizacion();
        Local.setMainActivity(this);
        final boolean gpsEnabled = mlocManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        if (!gpsEnabled) {
            Intent settingsIntent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            startActivity(settingsIntent); }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION,}, 1000);
            return;  }

        mlocManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, (LocationListener) Local);
        mlocManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, (LocationListener) Local);
        mensaje1.setText("Localización agregada");
        mensaje2.setText("");     }



    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1000) {
            if (grantResults[0] == PackageManager.PERMISSION_GRANTED) { locationStart(); } } }



    public void setLocation(Location loc) {
        //Obtener la direccion de la calle a partir de la latitud y la longitud
        //Ponemos que es diferente de 0 para poder evitar errores

        if (loc.getLatitude() != 0.0 && loc.getLongitude() != 0.0) {
            try {
                Geocoder geocoder = new Geocoder(this, Locale.getDefault());
                List<Address> list = geocoder.getFromLocation(
                        loc.getLatitude(), loc.getLongitude(), 1);
                if (!list.isEmpty()) {
                    Address DirCalle = list.get(0);
                    mensaje2.setText("Mi dirección es: \n" + DirCalle.getAddressLine(0)); }

            } catch (IOException e) {
                e.printStackTrace();
            }
        }





    }


    // esta clase cada vez que se actualiza se va a recopilar los datos de la latitud y longitud
    public class Localizacion implements LocationListener {

        MainActivity mainActivity;

        public void setMainActivity(MainActivity mainActivity) {
            this.mainActivity = mainActivity;
        }

        public void onLocationChanged(Location loc) {


            String Text = "Mi ubicacion actual es: " + "\n Latitud = " + loc.getLatitude() + "\n Longitud = " + loc.getLongitude();
            mensaje1.setText(Text);
            this.mainActivity.setLocation(loc);


            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.INTERNET) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.INTERNET}, 1000);
            }


            MessageSender m = new MessageSender();
            MessageSender m1 = new MessageSender();
            MessageSender m2 = new MessageSender();
            MessageSender m3 = new MessageSender();
            MessageSender m4 = new MessageSender();


            String mensaje = numip.getText().toString()+";"+loc.getLatitude()+";"+loc.getLongitude()+";"+loc.getTime()+";";




            if (estado.isChecked()) {

                m.execute(mensaje,"bozoyuko.ddns.net");
                m1.execute(mensaje,"danielgonzale5.ddns.net");
                m2.execute(mensaje,"towarlexerddns.ddns.net");
                m3.execute(mensaje,"juanmartinez.ddns.net");
                m4.execute(mensaje,"leocamargo.ddns.net");

            }
        }


        public void onProviderDisabled(String provider) {
            // Este metodo se ejecuta cuando el GPS es desactivado
            mensaje1.setText("GPS Desactivado");
        }

        public void onProviderEnabled(String provider) {
            // Este metodo se ejecuta cuando el GPS es activado
            mensaje1.setText("GPS Activado");
        }

    }



}
