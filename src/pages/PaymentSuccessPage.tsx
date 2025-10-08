import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, CheckCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/src/lib/supabase'
import NotificationBell from '@/src/components/NotificationBell'

export default function PaymentSuccessPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProject = async () => {
      console.log('PaymentSuccessPage: Loading project with ID:', projectId)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('PaymentSuccessPage: User:', user)
      setUser(user)
      
      if (!projectId) {
        console.log('PaymentSuccessPage: No project ID provided')
        setError('No project ID provided')
        setLoading(false)
        return
      }

      try {
        const { data: projectData, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (error) {
          console.error('Error loading project:', error)
          setError(`Failed to load project: ${error.message}`)
        } else if (projectData) {
          setProject(projectData)
          
          // Update project payment status to paid
          const { error: updateError } = await supabase
            .from('projects')
            .update({ payment_status: 'paid' })
            .eq('id', projectId)
          
          if (updateError) {
            console.error('Error updating payment status:', updateError)
            setError(`Failed to update payment status: ${updateError.message}`)
          } else {
            console.log('Payment status updated to paid for project:', projectId)
            // Update local state
            setProject(prev => ({ ...prev, payment_status: 'paid' }))
          }
        } else {
          setError('Project not found')
        }
      } catch (error) {
        console.error('Error loading project:', error)
        setError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="space-y-2">
              <Link to="/client/dashboard">
                <Button variant="outline" className="w-full">
                  Return to Dashboard
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          {user && (
            <div className="flex justify-center mb-4">
              <NotificationBell userId={user?.id} />
            </div>
          )}
          <Link to="/" className="inline-flex items-center space-x-2">
            <Shield className="h-10 w-10 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">DisasterShield</span>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your payment has been processed successfully. Your contractor can now begin work on your project.
            </p>
            
            {project && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-green-900 mb-2">Project Details:</h4>
                <p className="text-sm text-green-800 mb-1">
                  <strong>Location:</strong> {project.address}, {project.city}, {project.state}
                </p>
                <p className="text-sm text-green-800 mb-1">
                  <strong>Damage Type:</strong> {project.peril.charAt(0).toUpperCase() + project.peril.slice(1)}
                </p>
                <p className="text-sm text-green-800">
                  <strong>Status:</strong> Payment completed - work can begin
                </p>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                You'll receive email confirmation shortly. Your contractor will contact you within 24 hours to coordinate the work.
              </p>
              
              <div className="space-y-3">
                <Link to={`/portal/${projectId}`}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    View Project Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/client/dashboard">
                  <Button variant="outline" className="w-full">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}