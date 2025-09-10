import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, CreditCard, DollarSign, CheckCircle, AlertCircle, ArrowLeft, XCircle } from 'lucide-react'
import { supabase } from '@/src/lib/supabase'
import { createCheckoutSession, redirectToCheckout, getUserOrders } from '@/src/lib/stripe'
import { STRIPE_PRODUCTS, formatPrice, type ProductKey } from '@/src/stripe-config'
import SubscriptionStatus from '@/src/components/SubscriptionStatus'
import NotificationBell from '@/src/components/NotificationBell'
import { env } from '@/src/lib/env'
import { toast } from 'sonner'

export default function PaymentPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paymentStatus = searchParams.get('payment')
  const [project, setProject] = useState<any>(null)
  const [contractor, setContractor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (!user) {
        navigate('/auth/login')
        return
      }

      if (!projectId) {
        setError('Invalid project ID')
        setLoading(false)
        return
      }
      
      // Check if payment was cancelled
      if (paymentStatus === 'cancelled') {
        setError('Payment was cancelled. Please try again or contact support if you continue to experience issues.')
      }

      // Check if payment was successful
      if (paymentStatus === 'success') {
        // Refresh the project data to get updated payment status
        console.log('Payment success detected, refreshing project data...')
        // Force refresh the project data
        setTimeout(async () => {
          try {
            const { data: refreshedProject, error: refreshError } = await supabase
              .from('projects')
              .select('*')
              .eq('id', projectId)
              .single()
            
            if (!refreshError && refreshedProject) {
              setProject(refreshedProject)
              console.log('Project data refreshed:', refreshedProject.payment_status)
            }
          } catch (error) {
            console.error('Error refreshing project data:', error)
          }
        }, 1000)
      }

      try {
        // Load project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (projectError || !projectData) {
          setError('Project not found')
          setLoading(false)
          return
        }

        // Check if user owns this project
        if (projectData.user_id !== user.id) {
          setError('Access denied')
          setLoading(false)
          return
        }

        setProject(projectData)

        // Load contractor details if assigned
        if (projectData.assigned_contractor_id) {
          const { data: contractorData } = await supabase
            .from('contractors')
            .select('*')
            .eq('id', projectData.assigned_contractor_id)
            .single()

          setContractor(contractorData)
        }

        // Load user's order history for this project
        try {
          const orderHistory = await getUserOrders(project.id)
          setOrders(orderHistory)
          
          // Also load completed orders for payment status checking
          if (user) {
            const { data: customerData, error: customerError } = await supabase
              .from('stripe_customers')
              .select('customer_id')
              .eq('user_id', user.id)
              .maybeSingle()

            if (!customerError && customerData) {
              const { data: completedOrdersData, error: ordersError } = await supabase
                .from('stripe_orders')
                .select('*')
                .eq('customer_id', customerData.customer_id)
                .eq('project_id', project.id)
                .eq('status', 'completed')

              if (!ordersError) {
                console.log('Loaded completed orders:', completedOrdersData)
                setCompletedOrders(completedOrdersData || [])
              } else {
                console.error('Error loading completed orders:', ordersError)
              }
            }
          }
        } catch (error) {
          console.error('Error loading orders:', error)
          setOrders([])
        }

        // Check if all orders are completed and update project status
        setTimeout(async () => {
          await checkAndUpdatePaymentStatus()
        }, 1000)
      } catch (error) {
        console.error('Error loading payment data:', error)
        setError('Failed to load project details')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [projectId, navigate, paymentStatus])

  // Helper function to check if a specific payment type is completed
  const isPaymentCompleted = (productKey: string) => {
    const isCompleted = completedOrders.some(order => order.product_id === productKey)
    console.log(`Payment check for ${productKey}:`, {
      productKey,
      completedOrders: completedOrders.length,
      isCompleted,
      orders: completedOrders.map(o => ({ amount: o.amount_total, product: o.product_id })),
      allOrders: completedOrders
    })
    return isCompleted
  }

  // Helper function to check if all required payments are completed
  const areAllPaymentsCompleted = () => {
    const requiredProducts = ['SECURITY_DEPOSIT', 'DISASTERSHIELD_SERVICE_FEE', 'EMERGENCY_RESPONSE_FEE']
    const allCompleted = requiredProducts.every(productKey => isPaymentCompleted(productKey))
    console.log('All payments completed check:', {
      requiredProducts,
      allCompleted,
      projectPaymentStatus: project?.payment_status,
      completedOrdersCount: completedOrders.length
    })
    return allCompleted
  }

  // Check if all required orders are completed and update project status
  const checkAndUpdatePaymentStatus = async () => {
    if (!project?.id) return

    setCheckingStatus(true)
    toast.loading('Checking payment status...', { id: 'payment-check' })

    // Add a small delay to prevent too frequent checking
    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      // Get all completed orders for this user
      // First get the user's Stripe customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', user?.id)
        .maybeSingle()

      if (customerError) {
        console.error('Error fetching customer data:', customerError)
        toast.error('Error fetching customer data', { id: 'payment-check' })
        return
      }

      if (!customerData) {
        console.log('No Stripe customer found for user - they will be created on first payment')
        toast.info('No payment history found. Customer will be created on first payment.', { id: 'payment-check' })
        return
      }

      // Then get orders for this customer and project
      const { data: completedOrders, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('*')
        .eq('customer_id', customerData.customer_id)
        .eq('project_id', project.id)
        .eq('status', 'completed')

      if (ordersError) {
        console.error('Error fetching orders:', ordersError)
        toast.error('Error fetching payment orders', { id: 'payment-check' })
        return
      }

      // Check if we have all required orders completed
      const requiredProducts = ['SECURITY_DEPOSIT', 'DISASTERSHIELD_SERVICE_FEE', 'EMERGENCY_RESPONSE_FEE']
      const completedProductIds = completedOrders?.map(order => order.product_id) || []
      
      const allRequiredCompleted = requiredProducts.every(productId => 
        completedProductIds.includes(productId)
      )

      // Update project payment status if all orders are completed
      if (allRequiredCompleted && project.payment_status !== 'paid') {
        console.log('All required orders completed, updating project status to paid')
        toast.loading('All payments completed! Updating project status...', { id: 'payment-check' })
        
        const { error: updateError } = await supabase
          .from('projects')
          .update({ payment_status: 'paid' })
          .eq('id', project.id)

        if (!updateError) {
          setProject(prev => ({ ...prev, payment_status: 'paid' }))
          toast.success('✅ All payments completed! Project status updated to Paid.', { id: 'payment-check' })
        } else {
          toast.error('❌ Error updating project status. Please try again.', { id: 'payment-check' })
        }
      } else if (allRequiredCompleted) {
        toast.success('✅ All payments are already completed!', { id: 'payment-check' })
      } else {
        const completedCount = completedProductIds.length
        toast.info(`📊 ${completedCount} of 3 payments completed. ${3 - completedCount} payments remaining.`, { id: 'payment-check' })
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      toast.error('❌ Error checking payment status. Please try again.', { id: 'payment-check' })
    } finally {
      setCheckingStatus(false)
    }
  }

  // Add polling to check for payment status updates
  useEffect(() => {
    if (!project || project.payment_status === 'paid') return

    const pollForUpdates = setInterval(async () => {
      try {
        const { data: updatedProject, error } = await supabase
          .from('projects')
          .select('payment_status')
          .eq('id', projectId)
          .single()

        if (!error && updatedProject && updatedProject.payment_status !== project.payment_status) {
          console.log('Payment status updated:', updatedProject.payment_status)
          setProject(prev => ({ ...prev, payment_status: updatedProject.payment_status }))
          clearInterval(pollForUpdates)
        }

        // Note: Removed automatic checkAndUpdatePaymentStatus call to reduce frequency
        // Users can manually check using the button
        
        // Refresh completed orders
        if (user) {
          const { data: customerData, error: customerError } = await supabase
            .from('stripe_customers')
            .select('customer_id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (!customerError && customerData) {
            const { data: completedOrdersData, error: ordersError } = await supabase
              .from('stripe_orders')
              .select('*')
              .eq('customer_id', customerData.customer_id)
              .eq('project_id', project.id)
              .eq('status', 'completed')

            if (!ordersError) {
              console.log('Polling - Loaded completed orders:', completedOrdersData)
              setCompletedOrders(completedOrdersData || [])
            } else {
              console.error('Polling - Error loading completed orders:', ordersError)
            }
          }
        }
      } catch (error) {
        console.error('Error polling for payment updates:', error)
      }
    }, 10000) // Poll every 10 seconds (reduced frequency)

    return () => clearInterval(pollForUpdates)
  }, [project, projectId])

  const handlePayment = async (productKey: ProductKey) => {
    if (!project || !user) return

    setProcessing(true)
    setError('')

    try {
      console.log(`Initiating payment for ${productKey} in TEST mode`)
      
      // Create Stripe checkout session
      const { sessionId, url: checkoutUrl } = await createCheckoutSession({
        productKey: productKey,
        successUrl: `${env.APP_URL || 'https://disaster-shield-v2.vercel.app'}/payment-success/${project.id}`,
        cancelUrl: `${env.APP_URL || 'https://disaster-shield-v2.vercel.app'}/payment-declined/${project.id}?reason=cancelled`,
        projectId: project.id,
      })

      if (!sessionId || !checkoutUrl) {
        throw new Error('Could not create checkout session')
      }

      console.log(`Redirecting to checkout with session ID: ${sessionId}`)
      console.log(`Using checkout URL from Stripe: ${checkoutUrl}`)
      
      try {
        // Use the URL provided by Stripe
        await redirectToCheckout(checkoutUrl)
        
        // Set a timeout to check if the redirect hasn't happened
        // (this handles cases where the redirect silently fails)
        setTimeout(() => {
          console.log('Redirect timeout - trying alternative approach')
          
          // Alternative approach: create a direct link for the user to click
          setError('Automatic redirect failed. Please click the button below to proceed to payment.')
          
          // Create a button for manual checkout using the URL from Stripe
          const checkoutBtn = document.createElement('button')
          checkoutBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4'
          checkoutBtn.textContent = 'Proceed to Checkout'
          checkoutBtn.onclick = () => window.open(checkoutUrl, '_blank')
          
          // Add the button to the error container
          const errorContainer = document.getElementById('payment-error-container')
          if (errorContainer) {
            errorContainer.appendChild(checkoutBtn)
          }
          
          setProcessing(false)
        }, 3000)
      } catch (redirectError) {
        console.error('Redirect error:', redirectError)
        
        // If redirectToCheckout fails, try direct URL redirect using Stripe's URL
        window.open(checkoutUrl, '_self')
      }

    } catch (error: any) {
      console.error('Payment error:', error)
      
      // Check for various error conditions
      if (error.message) {
        // Network errors
        if (error.message.includes('network') || error.message.includes('connection')) {
          setError('Network connection issue. Please check your internet connection and try again.')
          return;
        }
      }
      
      // Generic fallback error
      setError(`Payment failed: ${error.message || 'Please try again later'}`)
    } finally {
      // This might not execute if redirect is successful
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link to="/client/dashboard">
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to={`/portal/${project.id}`} className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
              <ArrowLeft className="h-5 w-5 mr-1" />
              <span className="text-sm font-medium">Back to Project</span>
            </Link>
            <div className="flex items-center space-x-2">
              <NotificationBell userId={user?.id} />
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DisasterShield</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
          <p className="text-gray-600">Complete your payment to proceed with the project</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Options */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Options
                  </CardTitle>
                  <SubscriptionStatus userId={user?.id} />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div id="payment-error-container" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Payment Error</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    </div>
                    {/* The manual checkout button will be inserted here if needed */}
                  </div>
                )}
                
                {paymentStatus === 'cancelled' && !error && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Payment Cancelled</p>
                      <p className="text-sm">Your payment was cancelled. You can try again when you're ready.</p>
                    </div>
                  </div>
                )}

                {areAllPaymentsCompleted() && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Payment Completed</p>
                      <p className="text-sm">Your payment has been processed successfully. Work can now begin on your project.</p>
                    </div>
                  </div>
                )}

                {/* Security Deposit */}
                {!isPaymentCompleted('SECURITY_DEPOSIT') && (
                  <div className="border rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{STRIPE_PRODUCTS.SECURITY_DEPOSIT.name}</h3>
                        <p className="text-gray-600 text-sm">{STRIPE_PRODUCTS.SECURITY_DEPOSIT.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{formatPrice(STRIPE_PRODUCTS.SECURITY_DEPOSIT.amount)}</p>
                        <p className="text-sm text-gray-500">Refundable</p>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      Required to begin work. This deposit will be applied to your final invoice or refunded if work is cancelled.
                    </p>
                    <Button 
                      onClick={() => handlePayment('SECURITY_DEPOSIT')}
                      disabled={processing}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {processing ? 'Processing...' : 'Pay Security Deposit'}
                    </Button>
                  </div>
                )}

                {/* Security Deposit - Completed */}
                {isPaymentCompleted('SECURITY_DEPOSIT') && (
                  <div className="border rounded-lg p-6 bg-green-50 border-green-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{STRIPE_PRODUCTS.SECURITY_DEPOSIT.name}</h3>
                        <p className="text-gray-600 text-sm">{STRIPE_PRODUCTS.SECURITY_DEPOSIT.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{formatPrice(STRIPE_PRODUCTS.SECURITY_DEPOSIT.amount)}</p>
                        <p className="text-sm text-gray-500">Refundable</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center p-4 bg-green-100 border border-green-300 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium">Payment Done!</span>
                    </div>
                  </div>
                )}

                {/* Service Fee */}
                <div className="border rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{STRIPE_PRODUCTS.DISASTERSHIELD_SERVICE_FEE.name}</h3>
                      <p className="text-gray-600 text-sm">{STRIPE_PRODUCTS.DISASTERSHIELD_SERVICE_FEE.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(STRIPE_PRODUCTS.DISASTERSHIELD_SERVICE_FEE.amount)}</p>
                      <p className="text-sm text-gray-500">One-time</p>
                    </div>
                  </div>
                  {isPaymentCompleted('DISASTERSHIELD_SERVICE_FEE') ? (
                    <div className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium">Payment Done!</span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handlePayment('DISASTERSHIELD_SERVICE_FEE')}
                      disabled={processing}
                      variant="outline"
                      className="w-full"
                    >
                      {processing ? 'Processing...' : 'Pay Service Fee'}
                    </Button>
                  )}
                  {/* Debug info */}
                  <div className="mt-2 text-xs text-gray-500">
                    Debug: {isPaymentCompleted('DISASTERSHIELD_SERVICE_FEE') ? 'Completed' : 'Not completed'} 
                    ({completedOrders.length} orders loaded)
                  </div>
                </div>

                {/* Emergency Service Fee */}
                <div className="border rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{STRIPE_PRODUCTS.EMERGENCY_RESPONSE_FEE.name}</h3>
                      <p className="text-gray-600 text-sm">{STRIPE_PRODUCTS.EMERGENCY_RESPONSE_FEE.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(STRIPE_PRODUCTS.EMERGENCY_RESPONSE_FEE.amount)}</p>
                      <p className="text-sm text-gray-500">One-time</p>
                    </div>
                  </div>
                  {isPaymentCompleted('EMERGENCY_RESPONSE_FEE') ? (
                    <div className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium">Payment Done!</span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handlePayment('EMERGENCY_RESPONSE_FEE')}
                      disabled={processing}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      {processing ? 'Processing...' : 'Pay Emergency Fee'}
                    </Button>
                  )}
                  {/* Debug info */}
                  <div className="mt-2 text-xs text-gray-500">
                    Debug: {isPaymentCompleted('EMERGENCY_RESPONSE_FEE') ? 'Completed' : 'Not completed'} 
                    ({completedOrders.length} orders loaded)
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order History */}
            {orders.length > 0 && (
              <Card className="shadow-lg mt-6">
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">Order #{order.id}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatPrice(order.amount_total)}
                          </p>
                          <Badge className={`text-xs border-0 ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Project Summary */}
          <div>
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">Property</h4>
                  <p className="text-sm text-gray-600">
                    {project.address}, {project.city}, {project.state}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900">Damage Type</h4>
                  <Badge className="bg-orange-100 text-orange-800 border-0">
                    {project.peril.charAt(0).toUpperCase() + project.peril.slice(1)}
                  </Badge>
                </div>

                {contractor && (
                  <div>
                    <h4 className="font-medium text-gray-900">Assigned Contractor</h4>
                    <p className="text-sm text-gray-600">{contractor.company_name}</p>
                    <p className="text-sm text-gray-600">{contractor.contact_name}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-gray-900">Payment Status</h4>
                  <Badge className={`border-0 ${
                    areAllPaymentsCompleted() 
                      ? 'bg-green-100 text-green-800' 
                      : completedOrders.length > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {areAllPaymentsCompleted() ? 'Paid' : 
                     completedOrders.length > 0 ? 'Partially Paid' : 'Unpaid'}
                  </Badge>
                </div>

                {areAllPaymentsCompleted() && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <p className="text-sm text-green-800">All payments completed successfully!</p>
                    </div>
                  </div>
                )}

                {/* Check Payment Status button */}
                {!areAllPaymentsCompleted() && (
                  <div className="mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={checkAndUpdatePaymentStatus}
                      disabled={checkingStatus}
                      className="text-xs"
                    >
                      {checkingStatus ? '🔄 Checking...' : '🔄 Check Payment Status'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription Status Card */}
            <SubscriptionStatus userId={user?.id} showCard={true} />

            {/* Security Notice */}
            <Card className="shadow-lg mt-6">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Secure Payment</h4>
                    <p className="text-sm text-gray-600">
                      All payments are processed securely through Stripe. 
                      Your payment information is encrypted and never stored on our servers.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}