# Series Complete for Plex

A web-based tool to analyze your Plex TV series library for completion status and missing episodes.

## Overview

Series Complete for Plex helps you identify which TV series in your Plex library are incomplete by analyzing your local files against online databases. Get insights into missing episodes, completion percentages, and series statistics.

## Features

- **Library Analysis**: Scan your Plex database to identify all TV series
- **Completion Tracking**: Calculate completion percentages for each series
- **Missing Episodes**: Identify which specific episodes are missing
- **Multiple APIs**: Support for TMDb, TheTVDB, and OpenAI for metadata
- **Export Options**: Export reports as PDF or JSON
- **Advanced Sorting**: Sort and group your series by various criteria
- **Statistics**: Detailed statistics about your library
- **Security**: Built with security best practices and input validation

## Requirements

- Node.js (v18 or higher)
- Plex Media Server with accessible database
- Internet connection for metadata APIs
- Web browser (Chrome, Firefox, Safari, Edge)

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Application**
   ```bash
   npm start
   ```
   
   The app uses a working `config.json` file with empty API key placeholders.

3. **Access the Web Interface**
   Open your browser to `http://localhost:3000`

4. **Configure API Keys** (Recommended)
   - Go to Settings → "Manage API Keys"
   - Add your API keys (see API Keys section below)
   - At least one API key is recommended for better results
   - The app works immediately even without API keys!
   - Your API keys are automatically saved to `config.local.json` (protected by .gitignore)

## API Keys

Series Complete for Plex uses external APIs to get accurate TV series information. **You need at least ONE API key for optimal results**, but the app will work with whatever you provide.

### TMDb (The Movie Database) - **STRONGLY RECOMMENDED**
TMDb provides the most comprehensive and reliable TV series data.

**How to get your TMDb API key:**
1. Go to [https://www.themoviedb.org/](https://www.themoviedb.org/)
2. Create a free account (click "Join TMDb" in the top right)
3. Confirm your email address
4. Go to Settings → API → Create → Developer → Accept terms
5. Fill out the form:
   - **Application Name**: "PlexComplete"
   - **Application URL**: "http://localhost:3000"
   - **Application Summary**: "Personal TV series completion tracker"
6. Your API Key (v3 auth) will be displayed - copy this into PlexComplete

**Cost**: Completely FREE with generous limits (thousands of requests per day)

### TheTVDB - **RECOMMENDED**
TheTVDB provides detailed episode information and is excellent as a backup source.

**How to get your TheTVDB API key:**
1. Go to [https://thetvdb.com/](https://thetvdb.com/)
2. Create a free account (click "Register")
3. Confirm your email address
4. Go to Dashboard → API Access
5. Click "Create API Key"
6. Fill out the form:
   - **API Key Name**: "PlexComplete"
   - **Description**: "Personal use for TV series tracking"
7. Your API key will be displayed - copy this into PlexComplete

**Cost**: FREE for personal use

### OpenAI - **OPTIONAL**
OpenAI provides AI-powered series analysis as a fallback when other APIs don't have data.

**How to get your OpenAI API key:**
1. Go to [https://platform.openai.com/](https://platform.openai.com/)
2. Create an account or sign in
3. Go to API Keys section
4. Click "Create new secret key"
5. Name it "PlexComplete" and copy the key
6. **Important**: Add billing information and set usage limits

**Cost**: Pay-per-use (approximately $0.001 per series analysis)
**Note**: Only needed as fallback for very obscure series

### OMDb - **OPTIONAL**
OMDb provides additional metadata and poster images.

**How to get your OMDb API key:**
1. Go to [http://www.omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx)
2. Select "FREE! (1,000 daily limit)"
3. Enter your email address
4. Check your email and click the activation link
5. Your API key will be displayed - copy this into PlexComplete

**Cost**: FREE (1,000 requests per day)

## Usage

1. **Load Your Library**: Click "Scan Library" to import your Plex TV series
2. **Analyze Series**: Click "Analyze" on individual series or use "Analyze All"
3. **View Results**: See completion percentages and missing episodes
4. **Export Reports**: Generate PDF or JSON reports of your analysis
5. **Settings**: Configure API keys and analysis preferences

## Plex Database Configuration

PlexComplete automatically detects your Plex database location, but you can customize it if needed:

### **Default Locations:**
- **Windows**: `C:\Users\[username]\AppData\Local\Plex Media Server\Plug-in Support\Databases\com.plexapp.plugins.library.db`
- **macOS**: `/Users/[username]/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`
- **Linux**: `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db`

### **Custom Database Path:**
If your Plex database is in a non-standard location, edit `config.json`:
```json
{
  "database": {
    "customPath": "D:\\MyPlexServer\\Database\\com.plexapp.plugins.library.db"
  }
}
```

## Configuration Tips

### **Minimum Setup (Works with just ONE API key):**
- **Only TMDb**: Gets series info, episode counts, and completion status
- **Only TheTVDB**: Gets detailed episode information and air dates  
- **Only OpenAI**: Uses AI to estimate series data (costs money)

### **Recommended Setup:**
- **TMDb + TheTVDB**: Best accuracy and detailed episode information
- **All APIs**: Maximum data coverage and fallback options

### **No API Keys:**
The app will still work but with limited accuracy, using basic episode estimation.

## 🔄 How the Fallback System Works

PlexComplete automatically tries multiple sources in order:

1. **TMDb** → If configured and finds the series ✅
2. **TheTVDB** → If TMDb fails or isn't configured 🔄
3. **OpenAI** → If previous APIs fail and OpenAI is configured 🤖
4. **OMDb** → As backup for additional metadata 🎭
5. **Local Estimation** → Uses your Plex data to estimate missing episodes 📊

**The app gracefully handles any combination of API keys - even zero!**

## Security

This application follows security best practices:
- Input validation on all endpoints
- SQL injection protection with parameterized queries
- Rate limiting on API endpoints
- Secure file handling with path validation
- No private data in logs or exports

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run security audit
npm audit

# Check code formatting
npm run lint
```

## License

Series Complete for Plex © 2025 by Akustikrausch

Licensed under Creative Commons Attribution-NonCommercial 4.0 International License.
See [LICENSE](LICENSE) for details.

For commercial use, please contact the authors.

## Support

- Check the built-in documentation at `/documentation.html`
- Review the Settings page for configuration options
- Ensure your Plex database is accessible to the application

## Version

Current version: 1.0.0

Built with security and privacy in mind.
