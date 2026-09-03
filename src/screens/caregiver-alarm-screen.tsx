// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

const Colors = {
  safe: '#2E7D32',
  danger: '#C62828',
  warning: '#F9A825',
  offline: '#757575',
  background: '#F5F5F5',
  cardBg: '#FFFFFF',
  text: '#1A1A1A',
  circleFill: 'rgba(46, 125, 50, 0.12)',
  circleStroke: '#2E7D32',
};

interface CaregiverScreenProps {
  ipEsp?: string;
}

// Repete a vibração do celular enquanto o idoso estiver fora (não só na transição)
const INTERVALO_REVIBRACAO = 60000; // 1min — alinhado ao intervalo de alarme do ESP32

// Quantas falhas de conexão seguidas até mostrar o aviso de "sem conexão"
const LIMITE_FALHAS_PARA_AVISO = 2;

export default function CaregiverAlarmScreen({ ipEsp = 'IP_ESP' }: CaregiverScreenProps) {
  const [posicaoIdoso, setPosicaoIdoso] = useState({
    latitude: -22.936069,
    longitude: -47.088264,
  });
  const [estaFora, setEstaFora] = useState(false);
  const [distancia, setDistancia] = useState(0);
  const [satelites, setSatelites] = useState<number | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [ultimaVibracao, setUltimaVibracao] = useState(0);
  const [falhasSeguidas, setFalhasSeguidas] = useState(0);

  // Centro/raio do perímetro — vindos do ESP32, que é a fonte da verdade
  // (evita duplicar/dessincronizar com o que foi configurado na tela de geofence)
  const [centroPerimetro, setCentroPerimetro] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [raioPerimetro, setRaioPerimetro] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  // Consulta o ESP32 periodicamente
  useEffect(() => {
    if (!ipEsp) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://${ipEsp.trim()}/status`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const dados = await response.json();

        setPosicaoIdoso({
          latitude: dados.latitude,
          longitude: dados.longitude,
        });
        setDistancia(dados.distancia);
        setSatelites(typeof dados.satelites === 'number' ? dados.satelites : null);
        setUltimaAtualizacao(new Date());
        setFalhasSeguidas(0); // conexão voltou a funcionar

        if (
          typeof dados.latCentro === 'number' &&
          typeof dados.lonCentro === 'number'
        ) {
          const novoCentro = {
            latitude: dados.latCentro,
            longitude: dados.lonCentro,
          };
          setCentroPerimetro(novoCentro);

          // Inclui os limites do círculo no enquadramento, não só o ponto central —
          // senão um raio pequeno fica menor que o zoom mínimo do fitToCoordinates
          const raio = typeof dados.raio === 'number' ? dados.raio : 10;
          const margemGraus = (raio * 1.5) / 111000; // metros -> graus, com folga de 50%
          const pontosEnquadramento = [
            { latitude: dados.latitude, longitude: dados.longitude },
            { latitude: novoCentro.latitude + margemGraus, longitude: novoCentro.longitude },
            { latitude: novoCentro.latitude - margemGraus, longitude: novoCentro.longitude },
            { latitude: novoCentro.latitude, longitude: novoCentro.longitude + margemGraus },
            { latitude: novoCentro.latitude, longitude: novoCentro.longitude - margemGraus },
          ];

          mapRef.current?.fitToCoordinates(pontosEnquadramento, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }
        if (typeof dados.raio === 'number') {
          setRaioPerimetro(dados.raio);
        }

        if (dados.foraDoPerimetro) {
          const agora = Date.now();
          if (!estaFora || agora - ultimaVibracao >= INTERVALO_REVIBRACAO) {
            Vibration.vibrate([500, 500, 500]);
            setUltimaVibracao(agora);
          }
          setEstaFora(true);
        } else {
          setEstaFora(false);
        }
      } catch (error) {
        // Não engole mais o erro silenciosamente — conta falhas pra avisar o usuário
        setFalhasSeguidas((atual) => atual + 1);
        console.warn('Falha ao consultar o ESP32:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [ipEsp, estaFora, ultimaVibracao]);

  const semConexao = falhasSeguidas >= LIMITE_FALHAS_PARA_AVISO;
  const sinalFraco = satelites !== null && satelites < 4;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cardStatus,
          {
            backgroundColor: semConexao
              ? Colors.offline
              : estaFora
              ? Colors.danger
              : Colors.safe,
          },
        ]}
      >
        <Text style={styles.statusTexto}>
          {semConexao
            ? '⚠ SEM CONEXÃO COM O DISPOSITIVO'
            : estaFora
            ? '⚠ FORA DA ÁREA SEGURA'
            : '✓ Dentro da área segura'}
        </Text>
        {!semConexao && (
          <Text style={styles.statusSubtexto}>
            Distância do centro: {distancia.toFixed(1)}m
          </Text>
        )}
        <Text style={styles.statusHora}>
          {ultimaAtualizacao
            ? `Última atualização: ${ultimaAtualizacao.toLocaleTimeString('pt-BR')}`
            : 'Aguardando primeira resposta do dispositivo...'}
        </Text>
      </View>

      {semConexao && (
        <View style={styles.cardAviso}>
          <Text style={styles.avisoTexto}>
            Não foi possível falar com o ESP32 em {ipEsp}. Verifique se o IP está correto e se
            ambos estão na mesma rede Wi-Fi.
          </Text>
        </View>
      )}

      {!semConexao && sinalFraco && (
        <View style={styles.cardAviso}>
          <Text style={styles.avisoTexto}>
            ⚠ Sinal de GPS fraco ({satelites} satélite{satelites === 1 ? '' : 's'}) — localização
            pode estar imprecisa
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.mapa}
        initialRegion={{
          latitude: posicaoIdoso.latitude,
          longitude: posicaoIdoso.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }}
      >
        {centroPerimetro && raioPerimetro !== null && (
          <Circle
            center={centroPerimetro}
            radius={raioPerimetro}
            fillColor={Colors.circleFill}
            strokeColor={Colors.circleStroke}
            strokeWidth={2}
          />
        )}

        {centroPerimetro && (
          <Marker
            coordinate={centroPerimetro}
            title="Centro da área segura"
            pinColor={Colors.safe}
            opacity={0.7}
          />
        )}

        <Marker
          coordinate={posicaoIdoso}
          title="Posição do Idoso"
          pinColor={estaFora ? Colors.danger : Colors.safe}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  cardStatus: { borderRadius: 12, padding: 16, marginBottom: 12 },
  statusTexto: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statusSubtexto: { color: '#FFF', fontSize: 14, marginTop: 2 },
  statusHora: { color: '#FFF', fontSize: 12, marginTop: 4, opacity: 0.8 },
  cardAviso: {
    backgroundColor: Colors.warning,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  avisoTexto: { color: '#1A1A1A', fontSize: 13, fontWeight: '600' },
  mapa: { flex: 1, borderRadius: 12 },
});