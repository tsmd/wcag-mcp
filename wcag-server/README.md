# WCAG MCP Server

This MCP server provides access to WCAG (Web Content Accessibility Guidelines) content through MCP resources. It allows accessing:

- Principles and guidelines
- Success criteria
- Understanding documents
- Techniques

## Installation

1. Make sure you have Node.js installed
2. Clone this repository
3. Install dependencies:

```bash
cd wcag-server
npm install
```

4. Build the server:

```bash
npm run build
```

## Configuration

The server requires access to the WCAG repository. You can specify the path to the WCAG repository using the `WCAG_PATH` environment variable.

## MCP Configuration

Add the following configuration to your MCP settings file:

```json
{
  "mcpServers": {
    "wcag-server": {
      "command": "node",
      "args": [
        "${PROJECT_PATH}/wcag-server/build/index.js"
      ],
      "env": {
        "WCAG_PATH": "${PROJECT_PATH}/wcag"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Replace `${PROJECT_PATH}` with the actual path to your project directory.

## Available Resources

### Static Resources

- `wcag://principles-guidelines` - WCAG Principles and Guidelines

### Resource Templates

- `wcag://criteria/{version}/{criterion-id}` - WCAG Success Criterion
  - Example: `wcag://criteria/22/accessible-authentication-minimum`
- `wcag://understanding/{version}/{criterion-id}` - WCAG Understanding Document
  - Example: `wcag://understanding/22/accessible-authentication-minimum`
- `wcag://techniques/{technology}/{technique-id}` - WCAG Technique
  - Example: `wcag://techniques/html/H44`

## Usage Examples

### Accessing Principles and Guidelines

```javascript
const response = await client.readResource('wcag://principles-guidelines');
console.log(response.contents[0].text);
```

### Accessing a Success Criterion

```javascript
const response = await client.readResource('wcag://criteria/22/accessible-authentication-minimum');
console.log(response.contents[0].text);
```

### Accessing an Understanding Document

```javascript
const response = await client.readResource('wcag://understanding/22/accessible-authentication-minimum');
console.log(response.contents[0].text);
```

### Accessing a Technique

```javascript
const response = await client.readResource('wcag://techniques/html/H44');
console.log(response.contents[0].text);
```

## License

This project is licensed under the MIT License.
