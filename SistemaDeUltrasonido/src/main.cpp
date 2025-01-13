#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <DNSServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h> // Biblioteca para manejar JSON

// Configuración del Access Point
const char* ssid = "Ultrasonido_Network";
const char* password = "12345678";

//endpoint de navegacion
const String url = "/192.168.4.1";

// Crear instancias del servidor web y DNS
AsyncWebServer server(80);
DNSServer dnsServer;

// Definición de pines
#define LED_PIN 2
#define TD_28 27 
#define TD_40 26

// Variables de configuración del dispositivo
String frecuencia = "";
int tiempo = 0;
bool deviceState = false;

// Inicializar SPIFFS
void initSPIFFS() {
    if (!SPIFFS.begin(true)) {
        return;
    }
}


// Manejar datos del cuerpo de la solicitud// Manejar datos del cuerpo de la solicitud
void handlePostBody(AsyncWebServerRequest *request, uint8_t *data, size_t len) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, data, len);
    if (error) {
        request->send(400, "application/json", "{\"message\":\"Error al analizar JSON\"}");
        return;
    }

    // Procesar datos del JSON
    frecuencia = doc["frecuencia"].as<String>();
    tiempo = doc["tiempo"].as<int>();
    int freqValue = doc["frecuencia"].as<int>();
   

    // Validar y aplicar configuración
    if (freqValue >= 1 && freqValue <= 5) {
        digitalWrite(TD_28, LOW);  // Activa el relé de 28kHz
        digitalWrite(TD_40, HIGH); // Desactiva el relé de 40kHz
    } else if (freqValue >= 6 && freqValue <= 10) {
        digitalWrite(TD_28, HIGH); // Desactiva el relé de 28kHz
        digitalWrite(TD_40, LOW);  // Activa el relé de 40kHz
    } else {
        request->send(400, "application/json", "{\"message\":\"Frecuencia no válida\"}");
        return;
    }

    deviceState = true;
    request->send(200, "application/json", "{\"message\":\"Configuración aplicada correctamente\"}");
}



void setup() {
    // Configuración de pines
    pinMode(LED_PIN, OUTPUT);
    pinMode(TD_28, OUTPUT);
    pinMode(TD_40, OUTPUT);

    //apagado (dado que el sistema recien se enciende)
    digitalWrite(TD_28, HIGH); 
    digitalWrite(TD_40, HIGH);
    // Inicializar SPIFFS
    initSPIFFS();

    // Configuración del WiFi como Access Point
    WiFi.softAP(ssid, password);
    

    // Iniciar el servidor DNS para el portal cautivo
    dnsServer.start(53, "*", WiFi.softAPIP());

    // Servir archivos estáticos desde SPIFFS
    server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");

    // Manejar el cuerpo de las solicitudes POST
    server.onRequestBody([](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        String body = String((char*)data).substring(0, len);

        // Verificar el endpoint solicitado
        if (request->url() == url+"/apagar") {
            // Procesar el endpoint "/apagar"
            if (body.indexOf("\"estado\":\"apagado\"") != -1) {
                //Logica negativa
                digitalWrite(TD_28, HIGH); //apagado
                digitalWrite(TD_40, HIGH);
                request->send(200, "application/json", "{\"message\":\"Dispositivo apagado\"}");
            } else {
                request->send(400, "application/json", "{\"error\":\"Estado no válido para apagar\"}");
            }
        } else if (request->url() == url+"/configurar") {
            
            // Aquí llamamos al método existente handlePostBody
            handlePostBody(request, data, len);
            request->send(200, "application/json", "{\"message\":\"Configuración procesada\"}");
        } else {
            // Manejar otros endpoints si es necesario
            request->send(404, "application/json", "{\"error\":\"Endpoint no encontrado\"}");
        }
    });


    // Redirigir solicitudes no manejadas al portal cautivo
    server.onNotFound([](AsyncWebServerRequest *request) {
        request->redirect("/");
    });

    // Iniciar el servidor web
    server.begin();
    

    // Indicar inicio con el LED
    digitalWrite(LED_PIN, HIGH);
    delay(1000);
    digitalWrite(LED_PIN, LOW);
}

void loop() {
    // Procesar solicitudes del servidor DNS
    dnsServer.processNextRequest();
}
