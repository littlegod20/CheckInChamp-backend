import swaggerJsdoc, { Options } from "swagger-jsdoc";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description: "A sample API",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
  },
  apis: ["./server/routes/*.ts"], // Path to your API documentation (JSDoc comments)
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
