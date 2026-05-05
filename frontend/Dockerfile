# /frontend/Dockerfile
FROM node:20

# Install the Ionic CLI globally
RUN npm install -g @ionic/cli

WORKDIR /app

# Run the Ionic development server and expose it to the network
CMD ["ionic", "serve", "--host=0.0.0.0", "--port=8100", "--no-open"]