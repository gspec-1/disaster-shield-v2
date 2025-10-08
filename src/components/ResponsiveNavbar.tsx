import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Menu, 
  X, 
  Settings, 
  LogOut,
  Bell,
  ShoppingCart as ShoppingCartIcon,
  User,
  ChevronLeft
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import NotificationBell from './NotificationBell'
import SubscriptionStatus from './SubscriptionStatus'
import ShoppingCart from './ShoppingCart'

interface ResponsiveNavbarProps {
  user?: any
  userRole?: 'client' | 'contractor' | 'admin'
  showShoppingCart?: boolean
  showSettings?: boolean
  settingsLink?: string
  welcomeText?: string
  onSignOut?: () => void
  showBackButton?: boolean
  backButtonText?: string
  backButtonLink?: string
  showNavLinks?: boolean
  navLinks?: Array<{ label: string; href: string }>
}

export default function ResponsiveNavbar({
  user,
  userRole = 'client',
  showShoppingCart = true,
  showSettings = true,
  settingsLink = '/profile',
  welcomeText,
  onSignOut,
  showBackButton = false,
  backButtonText = 'Back',
  backButtonLink = '/',
  showNavLinks = false,
  navLinks = []
}: ResponsiveNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const getWelcomeText = () => {
    if (welcomeText) return welcomeText
    
    switch (userRole) {
      case 'contractor':
        return `Welcome, ${user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}`
      case 'admin':
        return 'Admin Portal'
      default:
        return 'Welcome back!'
    }
  }

  const getSettingsText = () => {
    switch (userRole) {
      case 'contractor':
        return 'Settings'
      case 'admin':
        return 'Admin Settings'
      default:
        return 'Profile'
    }
  }

  const getSettingsIcon = () => {
    switch (userRole) {
      case 'contractor':
        return <Settings className="h-4 w-4" />
      case 'admin':
        return <Settings className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const renderDesktopNav = () => (
    <div className="hidden lg:flex items-center justify-between w-full relative">
      {/* Left side - empty for spacing */}
      <div className="flex-1"></div>
      
      {/* Center - Navigation Links - Absolutely positioned and centered */}
      {showNavLinks && navLinks.length > 0 && (
        <nav className="absolute left-1/2 transform -translate-x-1/2 flex space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-gray-700 hover:text-blue-600 transition-all duration-300 font-medium relative ${
                location.pathname === link.href ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      
      {/* Right side - User actions */}
      <div className="flex items-center space-x-4 flex-1 justify-end">
      
        {/* User-specific content - only show if user is logged in */}
        {user && (
          <>
            <span className="text-sm text-gray-600">{getWelcomeText()}</span>
            
            {/* Admin Portal Link for clients with admin role */}
            {userRole === 'client' && user?.role === 'admin' && (
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  Admin Portal
                </Button>
              </Link>
            )}
            
            {/* Shopping Cart - only for clients */}
            {showShoppingCart && userRole === 'client' && (
              <ShoppingCart userId={user?.id} />
            )}
            
            {/* Notification Bell */}
            <NotificationBell />
            
            {/* Subscription Status */}
            <SubscriptionStatus userId={user?.id} />
            
            {/* Settings */}
            {showSettings && (
              <Link to={settingsLink}>
                <Button variant="outline" size="sm">
                  {getSettingsIcon()}
                  <span className="ml-2">{getSettingsText()}</span>
                </Button>
              </Link>
            )}
          </>
        )}
        
        {/* Sign Out or Sign In/Sign Up */}
        {user ? (
          onSignOut && (
            <Button variant="outline" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )
        ) : (
          <div className="flex items-center space-x-2">
            <Link to="/auth/login">
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                Sign In
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )

  const renderMobileNav = () => (
    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 max-w-[90vw] sm:max-w-[85vw]">
          <div className="flex flex-col space-y-6 mt-6">
            {/* Welcome Text - First (only if user is logged in) */}
            {user && (
              <div className="text-sm text-gray-600 border-b pb-4">
                {getWelcomeText()}
              </div>
            )}
            
            {/* Navigation Links */}
            {showNavLinks && navLinks.length > 0 && (
              <div className="border-b pb-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
            
            {/* User-specific items - only show if user is logged in */}
            {user && (
              <>
                {/* Admin Portal Link for clients with admin role */}
                {userRole === 'client' && user?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin Portal</span>
                  </Link>
                )}
                
                {/* Shopping Cart - only for clients */}
                {showShoppingCart && userRole === 'client' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Payment History</span>
                    <ShoppingCart userId={user?.id} />
                  </div>
                )}
                
                {/* Subscription Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Subscription</span>
                  <SubscriptionStatus userId={user?.id} />
                </div>
                
                {/* Settings */}
                {showSettings && (
                  <Link 
                    to={settingsLink}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {getSettingsIcon()}
                    <span>{getSettingsText()}</span>
                  </Link>
                )}
              </>
            )}
            
            {/* Sign Out or Sign In/Sign Up */}
            {user ? (
              onSignOut && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onSignOut()
                    setIsMobileMenuOpen(false)
                  }}
                  className="w-full justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              )
            ) : (
              <div className="space-y-2">
                <Link 
                  to="/auth/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block"
                >
                  <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                    Sign In
                  </Button>
                </Link>
                <Link 
                  to="/auth/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block"
                >
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
  )

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Back Button */}
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Link 
                to={backButtonLink} 
                className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                {backButtonText && <span className="text-sm font-medium">{backButtonText}</span>}
              </Link>
            )}
            <Link to="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DisasterShield</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          {renderDesktopNav()}
          
          {/* Mobile Navigation - Notification Bell + Hamburger */}
          <div className="lg:hidden flex items-center space-x-2">
            {user && <NotificationBell />}
            {renderMobileNav()}
          </div>
        </div>
      </div>
    </header>
  )
}
