/**
 * Simple hash-based SPA Router for NUST NEXUS
 */
export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeEach = null;
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/login';
    
    if (this.beforeEach) {
      const canProceed = await this.beforeEach(hash, this.currentRoute);
      if (!canProceed) return;
    }
    
    this.currentRoute = hash;
    const handler = this.routes[hash];
    
    if (handler) {
      await handler();
    } else {
      // 404 fallback
      this.navigate('/login');
    }
  }

  navigate(path) {
    const currentHash = window.location.hash.slice(1);
    if (currentHash === path) {
      // Hash is already the same — force re-render (no hashchange event fires)
      this.handleRoute();
    } else {
      window.location.hash = path;
    }
  }

  getCurrentRoute() {
    return window.location.hash.slice(1) || '/login';
  }
}

export const router = new Router();
