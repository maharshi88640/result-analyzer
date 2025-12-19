import React from 'react';

import { 
  FileSpreadsheet, 
  Upload, 
  Table2, 
  History as HistoryIcon, 
  BarChart3, 
  Users, 
  BookOpen, 
  TrendingUp, 
  LogOut, 
  X as XIcon,
  Menu as MenuIcon,
  AlertTriangle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AnalysisSidebarProps {
  user: any;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  handleLogout: () => void;
  loadAnalysisHistory: () => void;
  setShowHistory: (show: boolean) => void;
  currentAnalysisView?: string;
  setCurrentAnalysisView?: (view: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const AnalysisSidebar: React.FC<AnalysisSidebarProps> = ({
  user,
  sidebarCollapsed,
  setSidebarCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen,
  handleLogout,
  loadAnalysisHistory,
  setShowHistory,
  currentAnalysisView,
  setCurrentAnalysisView
}) => {
  const navigate = useNavigate();
  const location = useLocation();








  // Define menu sections with analysis options
  const menuSections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        {
          id: 'upload',
          label: 'Upload Data',
          icon: <Upload className="h-5 w-5" />,
          path: '/',
          description: 'Upload and manage data files'
        }
      ]
    },
    {
      title: 'Analysis',
      items: [
        {
          id: 'data',
          label: 'Data Table',
          icon: <Table2 className="h-5 w-5" />,
          description: 'View the complete data table with all records'
        },

        {
          id: 'grade-analysis',
          label: 'Grade Wise Analysis',
          icon: <BarChart3 className="h-5 w-5" />,
          description: 'Grade distribution and subject-wise analysis'
        },
        {
          id: 'detention-analysis',
          label: 'Detention Analysis',
          icon: <AlertTriangle className="h-5 w-5" />,
          description: 'GTU detention rules and student risk assessment'
        }
      ]
    },
    {
      title: 'Tools',
      items: [
        {
          id: 'history',
          label: 'Analysis History',
          icon: <HistoryIcon className="h-5 w-5" />,
          description: 'View and load previous analysis states'
        }
      ]
    }

  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.path) {
      navigate(item.path);
    } else {
      // Navigate to data page for analysis items
      if (location.pathname !== '/data') {
        navigate('/data');
      }
      
      // Set the current analysis view
      if (setCurrentAnalysisView) {
        setCurrentAnalysisView(item.id);
      }
    }
    
    // Close mobile menu after navigation
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const handleShowHistory = () => {
    loadAnalysisHistory();
    setShowHistory(true);
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };


  const renderMenuItem = (item: MenuItem) => {
    const isActive = (() => {
      if (item.path) {
        return location.pathname === item.path;
      }
      return currentAnalysisView ? currentAnalysisView === item.id : false;
    })();

    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.id === 'history') {
            handleShowHistory();
          } else {
            handleMenuClick(item);
          }
        }}
        disabled={item.disabled}
        className={`w-full ${sidebarCollapsed ? 'px-2' : 'px-3'} py-3 rounded transition-colors text-left ${
          isActive 
            ? 'bg-blue-100 text-blue-800 border-r-2 border-blue-600' 
            : 'hover:bg-gray-100 text-gray-800'
        } ${sidebarCollapsed ? 'flex flex-col items-center' : 'flex items-center'} text-base ${
          item.disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={sidebarCollapsed ? item.label : ''}
      >
        <div className="flex items-center">
          {item.icon}
          {!sidebarCollapsed && (
            <div className="ml-2 flex-1">
              <div className="flex items-center justify-between">
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              {!sidebarCollapsed && item.description && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.description}
                </div>
              )}
            </div>
          )}
        </div>
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-5 border-b flex items-center justify-between">
        <div className="flex items-center">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          {!sidebarCollapsed && (
            <span className="ml-2 text-lg font-semibold text-gray-900">
              Result Analyzer
            </span>
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {menuSections.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-2">
            {!sidebarCollapsed && (
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map(renderMenuItem)}
            </div>
            {sectionIndex < menuSections.length - 1 && !sidebarCollapsed && (
              <hr className="border-gray-200" />
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      {user && (
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t`}>
          {!sidebarCollapsed && (
            <div className="text-xs text-gray-500 mb-1">Signed in as</div>
          )}
          <div className="text-base font-medium text-gray-800 truncate">
            {sidebarCollapsed ? user.name?.charAt(0) : user.name}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-3 w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 ${
              sidebarCollapsed ? 'flex flex-col items-center' : 'flex items-center justify-center'
            }`}
          >
            <LogOut className="h-4 w-4" />
            <span className={`${sidebarCollapsed ? 'mt-1 text-xs' : 'ml-2'}`}>
              Logout
            </span>
          </button>
        </div>
      )}
    </div>
  );

  // Desktop Sidebar
  const desktopSidebar = (
    <aside 
      className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-72'} transition-all duration-200 flex-col bg-white border-r`}
    >
      {sidebarContent}
    </aside>
  );

  // Mobile Sidebar
  const mobileSidebar = (
    <div className={`fixed inset-0 z-50 md:hidden ${!mobileMenuOpen ? 'hidden' : ''}`}>
      <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)}></div>
      <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="ml-2 font-semibold">Result Analyzer</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)} 
            className="text-gray-600" 
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebarContent}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {desktopSidebar}
      {mobileSidebar}
    </>
  );
};

export default AnalysisSidebar;
