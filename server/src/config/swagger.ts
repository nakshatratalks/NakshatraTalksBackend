import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NakshatraTalks API',
      version: '1.0.0',
      description: `
        API documentation for NakshatraTalks application.

        ## Authentication
        This API uses JWT Bearer token authentication. To access protected endpoints:
        1. Call POST /auth/send-otp with your phone number
        2. Call POST /auth/verify-otp with the OTP you received
        3. Copy the access_token from the response
        4. Click the "Authorize" button (lock icon) at the top right
        5. Enter your token in the format: Bearer <your_access_token>
        6. Click "Authorize" and "Close"

        Now you can access protected endpoints like GET /auth/me
      `,
      contact: {
        name: 'API Support',
        email: 'support@nakshatratalks.com',
      },
    },
    servers: [
      {
        url: 'http://147.79.66.3:4000',
        description: 'Production server',
      },
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Error Type',
            },
            message: {
              type: 'string',
              example: 'Error message description',
            },
          },
        },
      },
    },
    security: [],
  },
  // In development, scan TypeScript source files
  // In production (compiled), scan JavaScript files in dist
  apis: process.env.NODE_ENV === 'production'
    ? ['./dist/routes/*.js', './dist/controllers/*.js', './dist/server.js', './dist/config/swagger-definitions.js']
    : ['./src/routes/*.ts', './src/controllers/*.ts', './src/server.ts', './src/config/swagger-definitions.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NakshatraTalks API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
    },
  }));

  // Serve swagger spec as JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger documentation available at http://localhost:4000/api-docs');
  console.log('🔐 Use the "Authorize" button to test protected endpoints');
};
