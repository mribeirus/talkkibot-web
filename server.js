  const viewsMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views$/);
  if (viewsMatch && req.method === 'GET') {
    return proxyJson(req, res, '/api/v1/projects/' + viewsMatch[1] + '/views');
  }

  const viewTasksMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views\/(\d+)\/tasks$/);
  if (viewTasksMatch && req.method === 'GET') {
    return proxyJson(
      req,
      res,
      '/api/v1/projects/' + viewTasksMatch[1] + '/views/' + viewTasksMatch[2] + '/tasks'
    );
  }

  const condominioTasksMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/tasks$/);
  if (condominioTasksMatch && req.method === 'PUT') {
    return proxyJson(req, res, '/api/v1/projects/' + condominioTasksMatch[1] + '/tasks');
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch && req.method === 'POST') {
    return proxyJson(req, res, '/api/v1/tasks/' + taskMatch[1]);
  }

  if (taskMatch && req.method === 'DELETE') {
    return proxyJson(req, res, '/api/v1/tasks/' + taskMatch[1]);
  }
