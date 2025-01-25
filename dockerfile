# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Compile TypeScript to JavaScript
#RUN npm run start

# Expose the application port (adjust if your app uses a different port)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
