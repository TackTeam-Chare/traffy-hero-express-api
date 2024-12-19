# Use the latest stable Node.js version as the base image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files to the container
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application source code
COPY . .

# Expose the port for the Express.js application
EXPOSE 5000

# Set the environment variables for production
ENV NODE_ENV=production

# Start the Express.js server
CMD ["node", "src/app.js"]
