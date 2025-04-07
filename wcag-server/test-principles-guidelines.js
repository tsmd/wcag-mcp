#!/usr/bin/env node

/**
 * Test script to access the wcag://principles-guidelines resource
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    console.log('Starting test for wcag://principles-guidelines resource');
    
    // Spawn the MCP server process
    const serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', process.stderr],
    });
    
    // Create a transport that connects to the server process
    const transport = new StdioClientTransport(
      serverProcess.stdin,
      serverProcess.stdout
    );
    
    // Create an MCP client
    const client = new Client();
    
    // Connect to the server
    console.log('Connecting to WCAG MCP server...');
    await client.connect(transport);
    console.log('Connected to WCAG MCP server');
    
    // List available resources
    console.log('Listing available resources...');
    const resources = await client.listResources();
    console.log('Available resources:', resources);
    
    // Access the principles-guidelines resource
    console.log('Accessing wcag://principles-guidelines resource...');
    const resource = await client.readResource('wcag://principles-guidelines');
    
    // Save the resource content to a file
    const outputPath = path.join(process.cwd(), 'principles-guidelines.md');
    fs.writeFileSync(outputPath, resource.contents[0].text, 'utf-8');
    console.log(`Resource content saved to ${outputPath}`);
    
    // Print the first 500 characters of the content
    console.log('Resource content preview:');
    console.log(resource.contents[0].text.substring(0, 500) + '...');
    
    // Close the connection
    await client.close();
    serverProcess.kill();
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
