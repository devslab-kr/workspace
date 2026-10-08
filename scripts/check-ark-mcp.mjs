import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const child = spawn('cmd.exe', ['/d', '/s', '/c', 'npx.cmd -y @ark-ui/mcp'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map(); let sequence = 0; let buffer = '';
child.stderr.on('data', chunk => process.stderr.write(chunk));
child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  for (;;) {
    const end = buffer.indexOf('\n'); if (end < 0) break;
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    let message; try { message = JSON.parse(line); } catch { continue; }
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result); }
  }
});
function send(message) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); }
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); send({ id, method, params });
  });
}
const timer = setTimeout(() => { process.stderr.write('Ark MCP verification timed out\n'); child.stdin.end(); child.kill(); process.exit(1); }, 45000);
try {
  const init = await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'devslab-verification', version: '0.1.0' } });
  send({ method: 'notifications/initialized' });
  const listed = await call('tools/list');
  console.log(JSON.stringify({ server: init.serverInfo, tools: listed.tools.map(t => t.name) }, null, 2));
  const componentTool = listed.tools.find(t => t.name === 'list_components');
  if (componentTool) {
    const components = await call('tools/call', { name: componentTool.name, arguments: { framework: 'solid' } });
    if (components.isError) throw new Error(JSON.stringify(components));
    await writeFile(new URL('../docs/ark-mcp-components.json', import.meta.url), JSON.stringify(components, null, 2));
    console.log('list_components response saved successfully');
  }
  for (const component of ['tabs', 'dialog']) {
    const props = await call('tools/call', { name: 'get_component_props', arguments: { framework: 'solid', component } });
    if (props.isError) throw new Error(JSON.stringify(props));
    await writeFile(new URL(`../docs/ark-mcp-${component}-props.json`, import.meta.url), JSON.stringify(props, null, 2));
    console.log(`${component}: get_component_props response saved successfully`);
  }
} finally {
  clearTimeout(timer); child.stdin.end();
  setTimeout(() => { child.kill(); process.exit(0); }, 1000).unref();
}
