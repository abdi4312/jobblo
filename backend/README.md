# Jobblo Backend

This is the backend for the Jobblo app. It provides RESTful APIs.

## How to Run the Backend

1. **Install dependencies**
   ```sh
   npm install

   ```

2. **Set up environment variables**
   - Copy `.env.example` to `.env` (if available) or create a `.env` file with your MongoDB URI and any secrets you need.
   
   Example `.env`:
   ```
   MONGO_URI=mongodb://username:password@host:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@your-account@
   ```

3. **Start the server**
   ```sh
   npm start
   ```
   The backend will run on [http://localhost:5000](http://localhost:5000) by default.

4. **API Documentation**
   - Visit [http://localhost:5000/api/docs](http://localhost:5000/api/docs) for Swagger API docs and to test endpoints.
