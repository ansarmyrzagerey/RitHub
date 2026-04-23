FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including pdfkit). Use npm install to avoid lockfile mismatch during image build.
RUN npm install --silent

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 5000

# Note: We don't COPY . . here because we're using volume mounts
# This allows hot-reload to work properly with nodemon
# Start with nodemon for development (hot-reload)
CMD ["npm", "run", "dev"]