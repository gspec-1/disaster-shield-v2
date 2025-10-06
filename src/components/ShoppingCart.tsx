import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ShoppingCart as ShoppingCartIcon, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  X, 
  ExternalLink,
  DollarSign,
  Calendar,
  FileText
} from 'lucide-react'
import { supabase } from '@/src/lib/supabase'
import { getUserOrders } from '@/src/lib/stripe'
import { formatPrice } from '@/src/stripe-config'
import { isConfigured } from '@/src/lib/supabase'
import { Link } from 'react-router-dom'

interface ShoppingCartProps {
  userId?: string
}

interface Order {
  id: number
  checkout_session_id: string
  payment_intent_id: string
  customer_id: string
  project_id?: string
  product_id?: string
  amount_subtotal: number
  amount_total: number
  currency: string
  payment_status: string
  status: 'pending' | 'completed' | 'canceled'
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  address: string
  city: string
  state: string
  peril: string
  status: string
  payment_status: string
}

export default function ShoppingCart({ userId }: ShoppingCartProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [projects, setProjects] = useState<Record<string, Project>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const getUser = async () => {
      if (!isConfigured || !supabase) return
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }

    getUser()

    // Listen for auth changes
    if (isConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null)
      })

      return () => subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadOrders = async () => {
      if (!user || !isConfigured) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Get all orders for the user
        const userOrders = await getUserOrders()
        setOrders(userOrders)

        // Get unique project IDs from orders
        const projectIds = Array.from(new Set(userOrders.map(order => order.project_id).filter(Boolean)))
        
        if (projectIds.length > 0) {
          // Fetch project details
          const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select('id, address, city, state, peril, status, payment_status')
            .in('id', projectIds)

          if (!projectsError && projectsData) {
            const projectsMap = projectsData.reduce((acc, project) => {
              acc[project.id] = project
              return acc
            }, {} as Record<string, Project>)
            setProjects(projectsMap)
          }
        }
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [user])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Don't render if Supabase is not configured or no user
  if (!isConfigured || !user) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'canceled':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'canceled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProductName = (productId?: string) => {
    switch (productId) {
      case 'SECURITY_DEPOSIT':
        return 'Security Deposit'
      case 'DISASTERSHIELD_SERVICE_FEE':
        return 'Service Fee'
      case 'REPAIR_COST_ESTIMATE':
        return 'Repair Cost'
      case 'FNOL_GENERATION_FEE':
        return 'FNOL Generation'
      default:
        return 'Payment'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const totalSpent = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + order.amount_total, 0)

  const pendingPayments = orders.filter(order => order.status === 'pending').length
  const completedPayments = orders.filter(order => order.status === 'completed').length

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ShoppingCartIcon className="h-5 w-5" />
        {orders.length > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 text-white text-xs">
            {orders.length > 99 ? '99+' : orders.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 z-50">
          <Card className="shadow-lg border-0 max-h-96 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Loading payment history...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <ShoppingCartIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No payments yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Your payment history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Summary Stats */}
                  <div className="p-3 bg-gray-50 border-b">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{completedPayments}</div>
                        <div className="text-gray-500">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-yellow-600">{pendingPayments}</div>
                        <div className="text-gray-500">Pending</div>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{formatPrice(totalSpent)}</div>
                      <div className="text-gray-500">Total Spent</div>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  {orders.slice(0, 10).map((order) => {
                    const project = order.project_id ? projects[order.project_id] : null
                    return (
                      <div key={order.id} className="p-3 hover:bg-gray-50 border-b last:border-b-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(order.status)}
                              <span className="font-medium text-sm">
                                {getProductName(order.product_id)}
                              </span>
                              <Badge className={`text-xs border-0 ${getStatusColor(order.status)}`}>
                                {order.status}
                              </Badge>
                            </div>
                            
                            {project && (
                              <div className="text-xs text-gray-600 mb-1">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {project.address}, {project.city}, {project.state}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatDate(order.created_at)}
                            </div>
                          </div>
                          
                          <div className="text-right ml-2">
                            <div className="font-semibold text-sm">
                              {formatPrice(order.amount_total)}
                            </div>
                            {order.status === 'completed' && (
                              <div className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Paid
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {orders.length > 10 && (
                    <div className="p-3 text-center text-sm text-gray-500 border-t">
                      Showing 10 of {orders.length} payments
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            
            {orders.length > 0 && (
              <div className="p-3 border-t bg-gray-50">
                <Link to="/client/dashboard">
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Payments
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
