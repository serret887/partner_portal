'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Building2, Users, Home, Megaphone, Phone, CheckCircle, 
    TrendingUp, DollarSign, Award, AlertCircle, ArrowRight, ArrowLeft 
} from 'lucide-react';

type PartnerProfile = Database['public']['Tables']['partner_profiles']['Row'];

const partnerTypes = [
    { id: 'wholesaler', title: 'Wholesaler', description: 'I buy and sell properties quickly for profit', icon: Building2 },
    { id: 'investor', title: 'Investor', description: 'I buy properties for long-term investment', icon: Users },
    { id: 'real_estate_agent', title: 'Real Estate Agent', description: 'I help clients buy and sell properties', icon: Home },
    { id: 'marketing_partner', title: 'Marketing Partner', description: 'I help market and promote properties', icon: Megaphone }
];

const transactionTypes = [
    { id: 'fix_and_flip', label: 'Fix and Flip' },
    { id: 'long_term_rental', label: 'Long Term Rental' },
    { id: 'home_owners', label: 'Home Owners' },
    { id: 'multifamily', label: 'Multifamily' },
    { id: 'commercial_properties', label: 'Commercial Properties' }
];

const volumeRanges = [
    { id: '0-50000', label: '$0 - $50,000', min: 0 },
    { id: '50000-200000', label: '$50,000 - $200,000', min: 50000 },
    { id: '200000-500000', label: '$200,000 - $500,000', min: 200000 },
    { id: '500000-1000000', label: '$500,000 - $1,000,000', min: 500000 },
    { id: '1000000+', label: '$1,000,000+', min: 1000000 }
];

const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function OnboardingPage() {
    const { user } = useGlobal();
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profile, setProfile] = useState<Partial<PartnerProfile>>({
        partner_type: '',
        phone_number: '',
        is_phone_verified: false,
        deals_per_month: null,
        monthly_volume: null,
        transaction_types: [],
        license_number: null,
        license_state: null,
        onboarding_completed: false
    });

    // Form state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [dealsPerMonth, setDealsPerMonth] = useState('');
    const [selectedVolumeRange, setSelectedVolumeRange] = useState('');
    const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<string[]>([]);
    const [licenseNumber, setLicenseNumber] = useState('');
    const [licenseState, setLicenseState] = useState('');

    useEffect(() => {
        if (!user?.id) {
            router.push('/auth/login');
            return;
        }
        loadExistingProfile();
    }, [user]);

    const loadExistingProfile = async () => {
        try {
            const supabase = await createSPASassClientAuthenticated();
            const { data, error } = await supabase.getPartnerProfile(user!.id);

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setProfile(data);
                setPhoneNumber(data.phone_number || '');
                setDealsPerMonth(data.deals_per_month?.toString() || '');
                setSelectedTransactionTypes(data.transaction_types || []);
                setLicenseNumber(data.license_number || '');
                setLicenseState(data.license_state || '');
                
                if (data.onboarding_completed) {
                    router.push('/app');
                    return;
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (updates: Partial<PartnerProfile>) => {
        try {
            setError('');
            const supabase = await createSPASassClientAuthenticated();
            
            const newProfile = { ...profile, ...updates };
            setProfile(newProfile);

            if (profile.id) {
                const { error } = await supabase.updatePartnerProfile(user!.id, updates);
                if (error) throw error;
            } else {
                const profileData = {
                    user_id: user!.id,
                    ...newProfile
                };
                const { data, error } = await supabase.createPartnerProfile(profileData);
                if (error) throw error;
                if (data) {
                    setProfile(prev => ({ ...prev, id: data[0]?.id }));
                }
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Failed to save profile');
        }
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const completeOnboarding = async () => {
        try {
            setError('');
            const supabase = await createSPASassClientAuthenticated();
            await supabase.completeOnboarding(user!.id);
            setCurrentStep(5);
        } catch (err) {
            console.error('Error completing onboarding:', err);
            setError('Failed to complete onboarding');
        }
    };

    const sendOTP = async () => {
        if (!phoneNumber || phoneNumber.replace(/\D/g, '').length !== 10) {
            setError('Please enter a valid 10-digit phone number');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setOtpSent(true);
            setError('');
        } catch (err) {
            setError('Failed to send verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const verifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setError('Please enter the 6-digit verification code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (otpCode === '123456') {
                await updateProfile({ 
                    phone_number: phoneNumber,
                    is_phone_verified: true 
                });
                nextStep();
            } else {
                setError('Invalid verification code. Please try again.');
            }
        } catch (err) {
            setError('Failed to verify code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading onboarding...</p>
                </div>
            </div>
        );
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                What type of partner are you?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">Select the option that best describes your role in real estate</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {partnerTypes.map((type) => {
                                    const Icon = type.icon;
                                    const isSelected = profile.partner_type === type.id;
                                    
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => updateProfile({ partner_type: type.id })}
                                            className={`p-4 text-left border rounded-lg transition-all ${
                                                isSelected
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className="h-6 w-6" />
                                                <div>
                                                    <div className="font-medium">{type.title}</div>
                                                    <div className="text-sm text-gray-500">{type.description}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );

            case 2:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5" />
                                Verify your phone number
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!otpSent ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number
                                        </label>
                                        <Input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="(555) 123-4567"
                                        />
                                    </div>
                                    <Button onClick={sendOTP} disabled={loading}>
                                        {loading ? 'Sending...' : 'Send Verification Code'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Alert>
                                        <CheckCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Verification code sent to {phoneNumber}
                                        </AlertDescription>
                                    </Alert>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Verification Code
                                        </label>
                                        <Input
                                            type="text"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="123456"
                                            className="text-center text-lg tracking-widest"
                                        />
                                        <p className="text-sm text-gray-500 mt-1">
                                            Demo code: <span className="font-mono">123456</span>
                                        </p>
                                    </div>
                                    <Button onClick={verifyOTP} disabled={loading}>
                                        {loading ? 'Verifying...' : 'Verify Code'}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );

            case 3:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Tell us about your business
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    How many deals do you currently close per month?
                                </label>
                                <Input
                                    type="number"
                                    value={dealsPerMonth}
                                    onChange={(e) => setDealsPerMonth(e.target.value)}
                                    placeholder="5"
                                    className="w-32"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    What is the volume you usually transact monthly?
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {volumeRanges.map((range) => (
                                        <button
                                            key={range.id}
                                            onClick={() => {
                                                setSelectedVolumeRange(range.id);
                                                updateProfile({ monthly_volume: range.min });
                                            }}
                                            className={`p-4 text-left border rounded-lg transition-all ${
                                                selectedVolumeRange === range.id
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="font-medium">{range.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    What type of transactions do you usually do?
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {transactionTypes.map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => {
                                                const newTypes = selectedTransactionTypes.includes(type.id)
                                                    ? selectedTransactionTypes.filter(id => id !== type.id)
                                                    : [...selectedTransactionTypes, type.id];
                                                setSelectedTransactionTypes(newTypes);
                                                updateProfile({ transaction_types: newTypes });
                                            }}
                                            className={`px-4 py-2 rounded-full border transition-all ${
                                                selectedTransactionTypes.includes(type.id)
                                                    ? 'border-primary-500 bg-primary-100 text-primary-700'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );

            case 4:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Award className="h-5 w-5" />
                                Almost done!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {profile.partner_type === 'real_estate_agent' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Real Estate License Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                License Number
                                            </label>
                                            <Input
                                                value={licenseNumber}
                                                onChange={(e) => setLicenseNumber(e.target.value)}
                                                placeholder="Enter your license number"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                State
                                            </label>
                                            <select
                                                value={licenseState}
                                                onChange={(e) => setLicenseState(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="">Select a state</option>
                                                {states.map((state) => (
                                                    <option key={state} value={state}>{state}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-semibold mb-2">Your Profile Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div><strong>Partner Type:</strong> {partnerTypes.find(t => t.id === profile.partner_type)?.title}</div>
                                    {profile.phone_number && <div><strong>Phone:</strong> {profile.phone_number}</div>}
                                    {profile.deals_per_month && <div><strong>Deals per Month:</strong> {profile.deals_per_month}</div>}
                                    {profile.monthly_volume && <div><strong>Monthly Volume:</strong> ${profile.monthly_volume.toLocaleString()}</div>}
                                    {profile.transaction_types && profile.transaction_types.length > 0 && (
                                        <div>
                                            <strong>Transaction Types:</strong>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {profile.transaction_types.map((type) => (
                                                    <Badge key={type} variant="secondary">
                                                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );

            case 5:
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                Welcome to VistoCapital!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">
                                Your partner profile has been successfully created. You're now ready to start exploring our platform and connecting with opportunities.
                            </p>
                            <div className="bg-primary-50 p-4 rounded-lg">
                                <h3 className="font-semibold mb-2">What's Next?</h3>
                                <ul className="space-y-2 text-sm">
                                    <li>• Explore the Dashboard</li>
                                    <li>• Browse Opportunities</li>
                                    <li>• Connect & Network</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Welcome to VistoCapital Partner Program
                    </h1>
                    <p className="text-gray-600">
                        Let's get you set up as a partner in just a few steps
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3, 4].map((step) => (
                            <div key={step} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    currentStep >= step 
                                        ? 'bg-primary-600 text-white' 
                                        : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {step}
                                </div>
                                {step < 4 && (
                                    <div className={`w-16 h-1 mx-2 ${
                                        currentStep > step ? 'bg-primary-600' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <Alert className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Step Content */}
                <div className="mb-8">
                    {renderStep()}
                </div>

                {/* Navigation */}
                {currentStep < 5 && (
                    <div className="flex justify-between">
                        <Button 
                            onClick={prevStep}
                            variant="outline"
                            disabled={currentStep === 1}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <Button 
                            onClick={currentStep === 4 ? completeOnboarding : nextStep}
                            disabled={
                                (currentStep === 1 && !profile.partner_type) ||
                                (currentStep === 2 && !profile.is_phone_verified) ||
                                (currentStep === 3 && (!dealsPerMonth || !selectedVolumeRange || selectedTransactionTypes.length === 0)) ||
                                (currentStep === 4 && profile.partner_type === 'real_estate_agent' && (!licenseNumber || !licenseState))
                            }
                        >
                            {currentStep === 4 ? 'Complete Onboarding' : 'Continue'}
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="text-center">
                        <Button onClick={() => router.push('/app')} size="lg">
                            Continue to Dashboard
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
} 