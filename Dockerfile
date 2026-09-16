FROM node:24-slim

WORKDIR /app

# Copy package files
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies
RUN npm install
RUN npm --prefix frontend install
RUN npm --prefix backend install

# Copy source code
COPY . .

# Expose ports
EXPOSE 4173 4000

# Run both dev servers
CMD ["npm", "run", "dev"]
