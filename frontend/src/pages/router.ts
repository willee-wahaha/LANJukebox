export class Router {
  private routes: Array<{ pattern: RegExp; handler: (params: any) => Promise<void> }> = [];

  addRoute(pathPattern: string, handler: (params: any) => Promise<void>) {

    const regexSource = pathPattern.replace(/:[^\s/]+/g, '([^/]+)');
    this.routes.push({
      pattern: new RegExp(`^${regexSource}$`),
      handler
    });
  }

  async navigate(url: string) {
    window.history.pushState({}, '', url);
    await this.resolve();
  }

  async resolve() {
    const path = window.location.pathname;

    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        // e.g. get "123" from "/album/123"
        const params: any = {};
        if (match[1]) params.id = match[1];
        
        await route.handler(params);
        return;
      }
    }
    // Default Page is HomePage
    this.navigate('/page');
  }
}
