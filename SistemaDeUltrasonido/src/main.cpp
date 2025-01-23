#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <DNSServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>

// Configuración del Access Point
const char *ssid = "Ultrasonido_Network";
const char *password = "12345678";
unsigned long endTimeMillis = 0; // Tiempo en milisegundos cuando el dispositivo debe apagarse

// Endpoint de navegación
const String url = "/192.168.4.1";

// Crear instancias del servidor web y DNS
AsyncWebServer server(80);
DNSServer dnsServer;

// Definición de pines
#define LED_PIN 2
#define reedPin 25
#define TD_40 26
#define TD_28 27

// Variables de configuración del dispositivo
String frecuencia = "";
int tiempo = 0;
bool deviceState = false;
// Inicializar SPIFFS
void initSPIFFS()
{
    if (!SPIFFS.begin(true))
    {
        Serial.println("Error al montar SPIFFS");
    }
}

// Función para agregar encabezados CORS a las respuestas
void addCorsHeaders(AsyncWebServerResponse *response)
{
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Manejar solicitudes POST para validar el estado de la tapa
void handlePostBody(AsyncWebServerRequest *request, uint8_t *data, size_t len)
{
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, data, len);
    if (error)
    {
        AsyncWebServerResponse *response = request->beginResponse(400, "application/json", "{\"message\":\"Error al analizar JSON\"}");
        addCorsHeaders(response);
        request->send(response);
        return;
    }

    frecuencia = doc["frecuencia"].as<String>();
    tiempo = doc["tiempo"].as<int>();
    int freqValue = doc["frecuencia"].as<int>();

    // Validar el estado del reed switch (tapa)
    bool reedState= digitalRead(reedPin);
    if (reedState == LOW)
    { // Si la tapa está abierta
        AsyncWebServerResponse *response = request->beginResponse(403, "application/json", "{\"message\":\"Error: La tapa está abierta. Cierre la tapa para continuar.\"}");
        addCorsHeaders(response);
        request->send(response);
        return;
    }

    // Configuración de frecuencia y tiempo
    endTimeMillis = millis() + (tiempo * 1000); // Establecer tiempo de finalización en milisegundos

    if (freqValue >= 1 && freqValue <= 5)
    {
        digitalWrite(TD_28, LOW);  // Activa el relé de 28kHz
        digitalWrite(TD_40, HIGH); // Desactiva el relé de 40kHz
    }
    else if (freqValue >= 6 && freqValue <= 10)
    {
        digitalWrite(TD_28, HIGH); // Desactiva el relé de 28kHz
        digitalWrite(TD_40, LOW);  // Activa el relé de 40kHz
    }
    else
    {
        AsyncWebServerResponse *response = request->beginResponse(400, "application/json", "{\"message\":\"Frecuencia no válida\"}");
        addCorsHeaders(response);
        request->send(response);
        return;
    }

    deviceState = true;
    AsyncWebServerResponse *response = request->beginResponse(200, "application/json", "{\"message\":\"Configuración aplicada correctamente\"}");
    addCorsHeaders(response);
    request->send(response);
}

void setup()
{
    // Configuración de pines
    pinMode(LED_PIN, OUTPUT);
    pinMode(TD_28, OUTPUT);
    pinMode(TD_40, OUTPUT);
    pinMode(reedPin, INPUT);

    // Apagado inicial
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

    // Manejar solicitudes OPTIONS para CORS
    server.on("/estado-tapa", HTTP_OPTIONS, [](AsyncWebServerRequest *request)
              {
        AsyncWebServerResponse *response = request->beginResponse(204); // Respuesta vacía para OPTIONS
        addCorsHeaders(response);
        request->send(response); });

    // Endpoint para validar el estado de la tapa
    server.on("/estado-tapa", HTTP_POST, [](AsyncWebServerRequest *request)
              {
        bool reedState = digitalRead(reedPin);
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json",
            reedState == HIGH ? "{\"estado\":\"cerrada\"}" : "{\"estado\":\"abierta\"}");
        addCorsHeaders(response);
        request->send(response); });

    // Manejar solicitudes POST para configuración y apagado
    server.onRequestBody([](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total)
                         {
        String body = String((char *)data).substring(0, len);

        if (request->url() == url + "/apagar") {
            if (body.indexOf("\"estado\":\"apagado\"") != -1) {
                digitalWrite(TD_28, HIGH); // Apagar transductores
                digitalWrite(TD_40, HIGH);
                AsyncWebServerResponse *response = request->beginResponse(200, "application/json", "{\"message\":\"Dispositivo apagado\"}");
                addCorsHeaders(response);
                request->send(response);
            } else {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", "{\"error\":\"Estado no válido para apagar\"}");
                addCorsHeaders(response);
                request->send(response);
            }
        } else if (request->url() == url + "/configurar") {
            handlePostBody(request, data, len);
        } else {
            AsyncWebServerResponse *response = request->beginResponse(404, "application/json", "{\"error\":\"Endpoint no encontrado\"}");
            addCorsHeaders(response);
            request->send(response);
        } });

    // Redirigir solicitudes no manejadas al portal cautivo
    server.onNotFound([](AsyncWebServerRequest *request)
                      {
        AsyncWebServerResponse *response = request->beginResponse(302);
        response->addHeader("Location", "/");
        addCorsHeaders(response);
        request->send(response); });

    // Iniciar el servidor web
    server.begin();

    // Indicar inicio con el LED
    digitalWrite(LED_PIN, HIGH);
    delay(1000);
    digitalWrite(LED_PIN, LOW);
    delay(1000);
}

void loop() {
    dnsServer.processNextRequest();

    // Leer el estado del reed switch (tapa)
    bool reedState = digitalRead(reedPin); // Asegúrate de leer el valor actual del reedPin

    // Verificar si el tiempo ha expirado o si la tapa está abierta
    if ((deviceState && millis() > endTimeMillis && endTimeMillis != 0) || (deviceState && reedState == LOW)) {
        // Apagar los transductores
        digitalWrite(TD_28, HIGH);
        digitalWrite(TD_40, HIGH);

        // Actualizar el estado del dispositivo
        deviceState = false;
        endTimeMillis = 0; // Reiniciar el tiempo de finalización
    }
}
