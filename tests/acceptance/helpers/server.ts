import { spawn, ChildProcess } from 'child_process';
import getPort from 'get-port';
import { fetch } from 'undici';

export interface ServerInstance {
  baseURL: string;
  stop: () => Promise<void>;
}

export async function startServer(): Promise<ServerInstance> {
  // Get a random free port
  const port = await getPort();
  const baseURL = `http://localhost:${port}`;

  // Start the server process
  const child = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, PORT: port.toString() },
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await waitForHealthCheck(baseURL, child);

  return {
    baseURL,
    stop: () => stopServer(child),
  };
}

async function waitForHealthCheck(baseURL: string, child: ChildProcess): Promise<void> {
  const maxAttempts = 50; // 5 seconds with 100ms intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${baseURL}/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  // If we get here, server didn't start
  await stopServer(child);
  throw new Error(`Server failed to start on ${baseURL} within 5 seconds`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    child.on('close', () => resolve());
    child.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);
  });
}
