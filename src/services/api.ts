import axios from 'axios';

export interface GeofencePayload {
  latitude: number;
  longitude: number;
  raio: number;
}

export async function salvarAreaSegura(dados: GeofencePayload, ipEsp: string): Promise<void> {
  const url = `http://${ipEsp.trim()}/geofence`;

  const response = await axios.post(url, dados, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 5000, // Timeout de 5s para o app não travar se o IP estiver errado
  });

  return response.data;
}