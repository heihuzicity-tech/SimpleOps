// 基本测试设置
// 由于@testing-library/jest-dom未安装，我们先使用基本设置

// 扩展expect匹配器
expect.extend({
  toBeInTheDocument(received) {
    const pass = received != null;
    return {
      message: () => `expected element ${pass ? 'not ' : ''}to be in the document`,
      pass,
    };
  },
});