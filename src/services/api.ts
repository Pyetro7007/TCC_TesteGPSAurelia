// import axios from 'axios';

// export interface GeofencePayload {
//   latitude: number;
//   longitude: number;
//   raio: number;
// }

// // Cria uma instância do Axios configurada
// const api = axios.create({
//   baseURL: 'https://sua-api.com/api', // Troque pela URL real do seu backend
//   timeout: 10000,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// export async function salvarAreaSegura(dados: GeofencePayload): Promise<void> {
//   try {
//     const response = await api.post('/geofence', dados, {
//       // headers: { Authorization: 'Bearer SEU_TOKEN_AQUI' } // Descomente se precisar de autenticação
//     });
//     return response.data;
//   } catch (error) {
//     if (axios.isAxiosError(error)) {
//       console.error('Erro de resposta da API:', error.response?.data);
//       throw new Error(error.response?.data?.message || 'Erro ao conectar com o servidor.');
//     }
//     throw error;
//   }
// }

// src/services/api.ts

export interface GeofencePayload {
  latitude: number;
  longitude: number;
  raio: number;
}

export async function salvarAreaSegura(dados: GeofencePayload): Promise<void> {
  // Simula o tempo de resposta da rede (1,5 segundos)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('Dados enviados (Mock):', dados);

  // Para testar a mensagem de ERRO, descomente a linha abaixo:
//   throw new Error('Erro simulado de conexão');
}