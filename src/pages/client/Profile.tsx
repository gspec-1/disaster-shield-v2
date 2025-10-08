import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Shield, Save, ChevronLeft, User, Mail, Phone, Building, Bell, Lock } from 'lucide-react'
import { supabase } from '@/src/lib/supabase'
import ResponsiveNavbar from '@/src/components/ResponsiveNavbar'
import { toast } from 'sonner'

interface ProfileData {
  id: string
  role: 'homeowner' | 'business_owner' | 'contractor' | 'admin'
  full_name: string
  phone: string | null
  email: string
  created_at: string
}

interface NotificationPreferences {
  email_notifications: boolean
  sms_notifications: boolean
  project_updates: boolean
  estimate_notifications: boolean
  payment_reminders: boolean
}

export default function ClientProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_notifications: true,
    sms_notifications: false,
    project_updates: true,
    estimate_notifications: true,
    payment_reminders: true
  })
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'homeowner' as 'homeowner' | 'business_owner'
  })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          navigate('/auth/login')
          return
        }

        setUser(user)

        // Load profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error loading profile:', profileError)
          toast.error('Failed to load profile data')
          return
        }

        if (profileData) {
          setProfile(profileData)
          setFormData({
            full_name: profileData.full_name || '',
            phone: profileData.phone || '',
            email: profileData.email || user.email || '',
            role: profileData.role === 'business_owner' ? 'business_owner' : 'homeowner'
          })
        }

        // Load notification preferences (you might want to create a separate table for this)
        // For now, we'll use localStorage as a placeholder
        const savedNotifications = localStorage.getItem('client_notifications')
        if (savedNotifications) {
          setNotifications(JSON.parse(savedNotifications))
        }

      } catch (error) {
        console.error('Error loading profile:', error)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [navigate])

  const handleSave = async () => {
    if (!user || !profile) return

    setSaving(true)
    try {
      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          email: formData.email,
          role: formData.role
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
        toast.error('Failed to update profile')
        return
      }

      // Update email in auth if it changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        })

        if (emailError) {
          console.error('Error updating email:', emailError)
          toast.error('Failed to update email address')
          return
        }
      }

      // Save notification preferences
      localStorage.setItem('client_notifications', JSON.stringify(notifications))

      toast.success('Profile updated successfully!')
      
      // Refresh the page to show updated data
      window.location.reload()

    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <ResponsiveNavbar
        user={user}
        userRole="client"
        showShoppingCart={true}
        showSettings={false}
        showBackButton={true}
        backButtonText="Back to Dashboard"
        backButtonLink="/client/dashboard"
        onSignOut={handleSignOut}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account information and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Personal Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Account Type</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'homeowner' | 'business_owner') => 
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homeowner">Homeowner</SelectItem>
                      <SelectItem value="business_owner">Business Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email_notifications"
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, email_notifications: !!checked })
                    }
                  />
                  <Label htmlFor="email_notifications">Email Notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sms_notifications"
                    checked={notifications.sms_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, sms_notifications: !!checked })
                    }
                  />
                  <Label htmlFor="sms_notifications">SMS Notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="project_updates"
                    checked={notifications.project_updates}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, project_updates: !!checked })
                    }
                  />
                  <Label htmlFor="project_updates">Project Updates</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="estimate_notifications"
                    checked={notifications.estimate_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, estimate_notifications: !!checked })
                    }
                  />
                  <Label htmlFor="estimate_notifications">Estimate Notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="payment_reminders"
                    checked={notifications.payment_reminders}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, payment_reminders: !!checked })
                    }
                  />
                  <Label htmlFor="payment_reminders">Payment Reminders</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Account Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Account ID</Label>
                  <Input value={profile?.id || ''} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Member Since</Label>
                  <Input 
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''} 
                    disabled 
                    className="bg-gray-50" 
                  />
                </div>
              </div>
              <div className="pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/auth/forgot-password')}
                  className="w-full md:w-auto"
                >
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/client/dashboard')}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Shield className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
