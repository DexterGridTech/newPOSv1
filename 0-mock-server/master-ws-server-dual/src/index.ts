import {MasterSlaveWebSocketServer} from './MasterSlaveWebSocketServer';

const server = new MasterSlaveWebSocketServer({
  port: 8888,
  basePath: '/mockMasterServer',
  logLevel: 'info',
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  server.close();
  process.exit(0);
});

export {MasterSlaveWebSocketServer};
export * from './types';
export * from './config';
