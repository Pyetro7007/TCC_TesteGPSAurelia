// Cola no Arduino e IDE (NÃO ESQUECE DE POR O WIFI E A SENHA AQUI E O IP DO MONITOR SERIAL NO CÓDIGO DO APLICATIVO)

#include <WiFi.h>
#include <WebServer.h>
#include <TinyGPS++.h>
#include <math.h>

#define RXD2 16
#define TXD2 17
#define PINO_LED 2
#define PINO_MOTOR 4

WebServer server(80);
TinyGPSPlus gps;

// --- Centro e raio do geofence (definidos pelo cuidador no app) ---
double latCentro = -22.936069;
double lonCentro = -47.088264;
double raioPerimetro = 5.0; // metros — recomendação: manter >= 10m devido ao ruído do GPS

// --- Intervalos de checagem (economia de bateria) ---
// const unsigned long intervaloDentro = 5UL * 60UL * 1000UL; // 5 minutos (produção)
// const unsigned long intervaloFora   = 1UL * 60UL * 1000UL; // 1 minuto (produção)
const unsigned long intervaloDentro = 15UL * 1000UL; // 15 segundos (TESTE)
const unsigned long intervaloFora   = 5UL * 1000UL;  // 5 segundos (TESTE)
unsigned long tempoAnterior = 0;

// --- Debounce de estado ---
int contadorDentro = 0;
int contadorFora = 0;
const int limiteDebounce = 2; // leituras seguidas pra confirmar mudança de estado
bool estaFora = false;

// --- Vibração/LED pulsados (não contínuos) enquanto fora ---
unsigned long ultimoPulso = 0;
const unsigned long intervaloPulso = 2000; // pulsa a cada 2s
const unsigned long duracaoPulso = 300;    // 300ms ligado
bool pulsoAtivo = false;

// --- Média móvel das leituras de GPS (suaviza ruído do sensor) ---
const int tamanhoJanela = 5;
double bufferLat[tamanhoJanela];
double bufferLon[tamanhoJanela];
int indiceBuffer = 0;
int leiturasValidas = 0; // conta quantas posições do buffer já foram preenchidas

// Valores expostos pro endpoint /status (últimos calculados)
double latAtual = 0;
double lonAtual = 0;
double distanciaAtual = 0;
int satelitesAtual = 0;

// Fórmula de Haversine: distância em metros entre dois pontos lat/lon
double calcularDistancia(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0; // raio da Terra em metros
  double dLat = radians(lat2 - lat1);
  double dLon = radians(lon2 - lon1);
  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(radians(lat1)) * cos(radians(lat2)) *
             sin(dLon / 2) * sin(dLon / 2);
  double c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return R * c;
}

// Adiciona a leitura atual ao buffer circular e retorna a média das leituras disponíveis
void calcularMedia(double latNova, double lonNova, double &latMedia, double &lonMedia) {
  bufferLat[indiceBuffer] = latNova;
  bufferLon[indiceBuffer] = lonNova;
  indiceBuffer = (indiceBuffer + 1) % tamanhoJanela;
  if (leiturasValidas < tamanhoJanela) leiturasValidas++;

  double somaLat = 0, somaLon = 0;
  for (int i = 0; i < leiturasValidas; i++) {
    somaLat += bufferLat[i];
    somaLon += bufferLon[i];
  }
  latMedia = somaLat / leiturasValidas;
  lonMedia = somaLon / leiturasValidas;
}

void enviarAlarme(double lat, double lon) {
  // TODO: enviar HTTP POST pro backend/app do cuidador com lat/lon e status "fora do perímetro"
  Serial.println("[ALARME] Idoso fora do perímetro! Notificando cuidador...");
  Serial.print("  Lat: "); Serial.print(lat, 6);
  Serial.print(" | Lon: "); Serial.println(lon, 6);
}

void avisarRetorno() {
  // TODO: enviar HTTP POST pro backend/app do cuidador avisando que voltou pro perímetro
  Serial.println("[INFO] Idoso voltou para dentro do perímetro.");
}

void gerenciarPulso() {
  if (!estaFora) {
    digitalWrite(PINO_LED, LOW);
    digitalWrite(PINO_MOTOR, LOW);
    return;
  }

  unsigned long agora = millis();
  if (!pulsoAtivo && (agora - ultimoPulso >= intervaloPulso)) {
    digitalWrite(PINO_LED, HIGH);
    digitalWrite(PINO_MOTOR, HIGH);
    pulsoAtivo = true;
    ultimoPulso = agora;
  } else if (pulsoAtivo && (agora - ultimoPulso >= duracaoPulso)) {
    digitalWrite(PINO_LED, LOW);
    digitalWrite(PINO_MOTOR, LOW);
    pulsoAtivo = false;
    ultimoPulso = agora;
  }
}

// --- HTTP: recebe a área segura definida pelo cuidador no app ---
void handleGeofence() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");

    int latIdx = body.indexOf("\"latitude\":");
    int lonIdx = body.indexOf("\"longitude\":");
    int raioIdx = body.indexOf("\"raio\":");

    if (latIdx != -1 && lonIdx != -1 && raioIdx != -1) {
      latCentro = body.substring(latIdx + 11, body.indexOf(',', latIdx)).toDouble();
      lonCentro = body.substring(lonIdx + 12, body.indexOf(',', lonIdx)).toDouble();
      raioPerimetro = body.substring(raioIdx + 7, body.indexOf('}', raioIdx)).toDouble();

      Serial.println("\n[HTTP] Nova área segura recebida do App!");
      Serial.printf("  Nova Lat Centro: %.6f\n", latCentro);
      Serial.printf("  Nova Lon Centro: %.6f\n", lonCentro);
      Serial.printf("  Novo Raio: %.2f m\n\n", raioPerimetro);

      // Zera debounce e buffer de média ao trocar a área segura,
      // pra não misturar leituras/contagens da área antiga com a nova
      contadorDentro = 0;
      contadorFora = 0;
      leiturasValidas = 0;
      indiceBuffer = 0;

      server.send(200, "application/json", "{\"status\":\"ok\"}");
      return;
    }
  }
  server.send(400, "application/json", "{\"error\":\"Payload inválido\"}");
}

// --- HTTP: status atual pro app do cuidador consultar (polling) ---
void handleStatus() {
  String json = "{";
  json += "\"latitude\":" + String(latAtual, 6) + ",";
  json += "\"longitude\":" + String(lonAtual, 6) + ",";
  json += "\"distancia\":" + String(distanciaAtual, 2) + ",";
  json += "\"satelites\":" + String(satelitesAtual) + ",";
  json += "\"foraDoPerimetro\":" + String(estaFora ? "true" : "false");
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_MOTOR, OUTPUT);

  // TODO: trocar por variável de ambiente / arquivo separado no .gitignore antes de commitar
  WiFi.begin("SEU_WIFI", "SUA_SENHA");
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n=========================================");
  Serial.print(">>> IP DO ESP32: ");
  Serial.println(WiFi.localIP());
  Serial.println("--- Aurélia SEEI: Geofence ---");
  Serial.println("=========================================");

  server.on("/geofence", HTTP_POST, handleGeofence);
  server.on("/status", HTTP_GET, handleStatus);
  server.begin();
}

void loop() {
  server.handleClient();

  // Leitura contínua do GPS em segundo plano
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }

  // Pulso de vibração/LED roda independente do intervalo de checagem
  gerenciarPulso();

  unsigned long intervaloAtual = estaFora ? intervaloFora : intervaloDentro;

  if (millis() - tempoAnterior >= intervaloAtual) {
    tempoAnterior = millis();

    if (!gps.location.isValid() || gps.location.age() > 2000) {
      Serial.printf(
        "GPS buscando sinal dos satélites... (válido: %s | satélites: %d | idade da leitura: %lu ms)\n",
        gps.location.isValid() ? "sim" : "não",
        gps.satellites.value(),
        gps.location.age()
      );
      return;
    }

    satelitesAtual = gps.satellites.value();
  
    double latBruta = gps.location.lat();
    double lonBruta = gps.location.lng();

    calcularMedia(latBruta, lonBruta, latAtual, lonAtual);

    // Aquecimento: só avalia geofence depois do buffer de média encher
    if (leiturasValidas < tamanhoJanela) {
      Serial.printf("[Calibrando média... %d/%d] Satélites: %d\n", leiturasValidas, tamanhoJanela, satelitesAtual);
      return;
    }

    distanciaAtual = calcularDistancia(latCentro, lonCentro, latAtual, lonAtual);

    Serial.println("\n=========================================");
    Serial.print("Lat bruta: "); Serial.print(latBruta, 6);
    Serial.print(" | Lon bruta: "); Serial.println(lonBruta, 6);
    Serial.print("Lat média: "); Serial.print(latAtual, 6);
    Serial.print(" | Lon média: "); Serial.println(lonAtual, 6);
    Serial.print("Satélites: "); Serial.println(satelitesAtual);
    Serial.print("Distância do centro (média): "); Serial.print(distanciaAtual, 2); Serial.println(" m");

    // Debounce: só confirma mudança de estado após leituras consecutivas
    if (distanciaAtual > raioPerimetro) {
      contadorFora++;
      contadorDentro = 0;
    } else {
      contadorDentro++;
      contadorFora = 0;
    }

    if (contadorFora >= limiteDebounce && !estaFora) {
      estaFora = true;
      enviarAlarme(latAtual, lonAtual);
    } else if (contadorDentro >= limiteDebounce && estaFora) {
      estaFora = false;
      avisarRetorno();
    } else if (estaFora) {
      // já confirmado fora, continua mandando alarme com localização atualizada
      enviarAlarme(latAtual, lonAtual);
    }

    Serial.print("Status: ");
    Serial.println(estaFora ? "FORA DO PERÍMETRO" : "Dentro do perímetro");
    Serial.println("=========================================");
  }
}
