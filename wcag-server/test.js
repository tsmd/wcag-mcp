#!/usr/bin/env node

/**
 * Simple test script for the WCAG MCP server
 * This script tests the various resource types provided by the server
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the server executable
const serverPath = join(__dirname, 'build', 'index.js');

// Start the server process
console.log('Starting WCAG MCP server...');
const serverProcess = spawn('node', [serverPath], {
  env: {
    ...process.env,
    WCAG_PATH: join(__dirname, '..', 'wcag')
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle server output
serverProcess.stdout.on('data', (data) => {
  console.log(`Server stdout: ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`Server stderr: ${data}`);
});

// Wait for the server to start
setTimeout(async () => {
  try {
    console.log('Testing resources...');
    
    // Test listing resources
    await testListResources(serverProcess);
    
    // Test listing resource templates
    await testListResourceTemplates(serverProcess);
    
    // Test reading principles and guidelines
    await testReadResource(serverProcess, 'wcag://principles-guidelines');
    
    // Test reading a success criterion
    await testReadResource(serverProcess, 'wcag://criteria/22/accessible-authentication-minimum');
    
    // Test reading an understanding document
    await testReadResource(serverProcess, 'wcag://understanding/22/accessible-authentication-minimum');
    
    // Test reading a technique
    await testReadResource(serverProcess, 'wcag://techniques/html/H44');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Kill the server process
    serverProcess.kill();
    console.log('Server process terminated');
  }
}, 1000);

/**
 * Test listing resources
 */
async function testListResources(serverProcess) {
  console.log('Testing list resources...');
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'resources/list',
    params: {}
  };
  
  const response = await sendRequest(serverProcess, request);
  
  if (!response.result || !response.result.resources || response.result.resources.length === 0) {
    throw new Error('No resources returned');
  }
  
  console.log(`Found ${response.result.resources.length} resources`);
  console.log('Resources:', JSON.stringify(response.result.resources, null, 2));
  
  return response;
}

/**
 * Test listing resource templates
 */
async function testListResourceTemplates(serverProcess) {
  console.log('Testing list resource templates...');
  
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/templates/list',
    params: {}
  };
  
  const response = await sendRequest(serverProcess, request);
  
  if (!response.result || !response.result.resourceTemplates || response.result.resourceTemplates.length === 0) {
    throw new Error('No resource templates returned');
  }
  
  console.log(`Found ${response.result.resourceTemplates.length} resource templates`);
  console.log('Resource templates:', JSON.stringify(response.result.resourceTemplates, null, 2));
  
  return response;
}

/**
 * Test reading a resource
 */
async function testReadResource(serverProcess, uri) {
  console.log(`Testing read resource: ${uri}...`);
  
  const request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/read',
    params: {
      uri
    }
  };
  
  const response = await sendRequest(serverProcess, request);
  
  if (!response.result || !response.result.contents || response.result.contents.length === 0) {
    throw new Error('No content returned');
  }
  
  console.log(`Resource ${uri} content length: ${response.result.contents[0].text.length} characters`);
  console.log('Content preview:', response.result.contents[0].text.substring(0, 100) + '...');
  
  return response;
}

/**
 * Send a request to the server and wait for a response
 */
function sendRequest(serverProcess, request) {
  return new Promise((resolve, reject) => {
    let responseData = '';
    
    // Set up a listener for the response
    const dataHandler = (data) => {
      responseData += data.toString();
      
      try {
        // Try to parse the response
        const response = JSON.parse(responseData);
        
        // Check if the response matches our request ID
        if (response.id === request.id) {
          // Remove the listener
          serverProcess.stdout.removeListener('data', dataHandler);
          
          if (response.error) {
            reject(new Error(`Server error: ${JSON.stringify(response.error)}`));
          } else {
            resolve(response);
          }
        }
      } catch (error) {
        // Ignore parsing errors, we might have received a partial response
      }
    };
    
    // Add the listener
    serverProcess.stdout.on('data', dataHandler);
    
    // Send the request
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}
