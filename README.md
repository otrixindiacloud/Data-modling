# Dark-Modeler

A comprehensive data modeling application that provides a visual interface for creating, managing, and exporting data models across conceptual, logical, and physical layers. Built with React, TypeScript, and Express.js.

## 🚀 Features

### Core Functionality
- **Multi-Layer Data Modeling**: Support for conceptual, logical, and physical data model layers
- **Visual Canvas**: Interactive drag-and-drop interface for creating data models
- **Data Object Management**: Create and manage data objects (tables/entities) with attributes
- **Relationship Modeling**: Define relationships between data objects (1:1, 1:N, N:M)
- **Smart Layout Management**: Automatic layout algorithms for optimal model visualization
- **Export Capabilities**: Export models to PDF, SVG, and various formats

### Advanced Features
- **AI-Powered Suggestions**: Intelligent recommendations for data modeling
- **Color Theme Management**: Customizable color palettes and themes
- **Data Source Integration**: Connect to various data sources (SQL, files, APIs)
- **Configuration Management**: Comprehensive settings and configuration options
- **Mobile-Responsive Design**: Touch-friendly interface for mobile devices
- **Real-time Collaboration**: Multi-user support with live updates

### User Interface
- **Resizable Panels**: Flexible layout with collapsible sidebars
- **Mini-map Navigation**: Overview and quick navigation of large models
- **Search and Filter**: Advanced search capabilities across models and objects
- **Properties Panel**: Detailed property editing for all model elements
- **Undo/Redo**: Full history management with timeline view

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Radix UI** for component library
- **React Flow** for canvas functionality
- **Framer Motion** for animations
- **Zustand** for state management
- **React Query** for data fetching

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Zod** for validation
- **WebSocket** support for real-time features

### Database
- **PostgreSQL** with comprehensive schema
- **Drizzle Kit** for migrations
- **Database Studio** integration

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn package manager

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Dark-Modeler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/dark_modeler
   PORT=5000
   NODE_ENV=development
   ```

4. **Database Setup**
   ```bash
   # Generate migrations
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Optional: Open database studio
   npm run db:studio
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production build
   npm run build
   npm start
   ```

## 🎯 Usage

### Getting Started
1. Open your browser and navigate to `http://localhost:5000`
2. The main modeler interface will load with a canvas and sidebar panels
3. Use the data explorer to browse existing models or create new ones
4. Drag and drop data objects onto the canvas to start modeling

### Creating Data Models
1. **Add Data Objects**: Click the "+" button in the data explorer or use the toolbar
2. **Define Attributes**: Double-click objects to add attributes and set properties
3. **Create Relationships**: Connect objects by dragging from one to another
4. **Layer Management**: Switch between conceptual, logical, and physical layers
5. **Export Models**: Use the export functionality to generate documentation

### Configuration
- Access configuration settings via the settings panel
- Customize color themes and visual preferences
- Configure data source connections
- Set up AI suggestions and automation rules

## 📁 Project Structure

```
Dark-Modeler/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── services/      # API services
│   │   ├── store/         # State management
│   │   └── types/         # TypeScript type definitions
├── server/                # Express.js backend
│   ├── services/          # Business logic services
│   └── routes.ts          # API route definitions
├── shared/                # Shared code between frontend and backend
│   └── schema.ts          # Database schema definitions
├── migrations/            # Database migration files
└── dist/                  # Built application files
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push schema changes to database
- `npm run db:generate` - Generate new migration files
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

### Code Organization
- **Components**: Modular React components with TypeScript
- **Services**: API integration and business logic
- **Hooks**: Custom React hooks for state and side effects
- **Types**: Comprehensive TypeScript definitions
- **Utils**: Helper functions and utilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `/docs` folder
- Review the API documentation for backend integration

## 🔮 Roadmap

- [ ] Enhanced AI-powered modeling suggestions
- [ ] Real-time collaborative editing
- [ ] Advanced export templates
- [ ] Plugin system for custom connectors
- [ ] Performance optimizations for large models
- [ ] Mobile app development

---

Built with ❤️ using modern web technologies
