// 运行时环境配置
// 这个文件会在index.html中被引入，用于动态配置API地址
window._env_ = {
  // API基础地址 - 在Docker环境中，前端通过nginx反向代理访问后端
  REACT_APP_API_BASE_URL: window.location.origin,
  
  // WebSocket地址
  REACT_APP_WS_BASE_URL: window.location.origin.replace('http', 'ws'),
  
  // 其他可能的配置
  REACT_APP_ENVIRONMENT: 'docker',
  REACT_APP_VERSION: '1.0.0'
};