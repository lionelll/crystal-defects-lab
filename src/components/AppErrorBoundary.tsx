import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('晶体缺陷实验室渲染失败', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <main className="app-error" role="alert">
        <h1>实验室暂时无法显示</h1>
        <p>请刷新页面重新加载三维场景。</p>
        <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
      </main>;
    }
    return this.props.children;
  }
}
