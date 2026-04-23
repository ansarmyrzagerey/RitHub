FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
# Use npm install in image build to avoid lockfile mismatch during CI builds
RUN npm install --silent

# Expose port
EXPOSE 3000

# Start the development server
# Note: We don't COPY . . here because we're using volume mounts
# This allows hot-reload to work properly
CMD ["npm", "start"]