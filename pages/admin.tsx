import React, { useState, useEffect } from 'react'
import { supabase } from '../src/lib/supabaseClient'
import {User,LogOut,FileText,Users,Settings,Search,Eye,Download,Save,GraduationCap,BookOpen,
  Star,ChevronDown,X,Menu,School,ChevronUp} from 'lucide-react'
import jsPDF from 'jspdf'


interface Submission {
  id: string;
  student_name: string;
  class: string;
  section: string;
  filename: string;
  uploaded_at: string;
  file_path: string;
}

interface Mark {
  id: string;
  student_name: string;
  class: string;
  section: string;
  marks: number;
  submission_id: string;
  created_at: string;
}

export default function Admin() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('submissions')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [sectionFilter, setSectionFilter] = useState<string>('')
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [markInput, setMarkInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showFileSettings, setShowFileSettings] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    getSession()
  }, [])

  useEffect(() => {
    if (user) {
      fetchSubmissions()
      fetchMarks()
    }
  }, [user])

  // 🔥 Realtime subscription for new submissions
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('submissions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => {
          const newSubmission = payload.new as Submission
          setSubmissions((prev) => [newSubmission, ...prev])
          showToast(`📥 New submission received from ${newSubmission.student_name}`)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const getSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    } catch (error) {
      console.error('Error getting session:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setUser(data.user)
      showToast("Welcome back! Successfully signed in to admin panel.")
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      showToast("Successfully signed out of admin panel.")
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setSubmissions(data || [])
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  const fetchMarks = async () => {
    try {
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMarks(data || [])
    } catch (error: any) {
      showToast(error.message, 'error')
    }
  }

  const previewFile = async (submission: Submission) => {
    setSelectedSubmission(submission);

    try {
      const { data, error } = await supabase.storage
        .from("submissions")
        .download(submission.file_path as string);

      if (error) {
        console.error("Error downloading file:", error.message);
        setFileContent(`⚠️ Failed to load file: ${error.message}`);
      } else if (data) {
        const text = await data.text();
        setFileContent(text);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setFileContent("⚠️ Unexpected error while loading file.");
    }

    const existingMark = marks.find((m) => m.submission_id === submission.id);
    setMarkInput(existingMark ? existingMark.marks.toString() : "");

    setShowPreviewModal(true);
  };

  const saveMark = async () => {
    if (!selectedSubmission || !markInput) return;

    try {
      const markValue = parseInt(markInput);
      if (isNaN(markValue) || markValue < 0 || markValue > 100) {
        showToast("Please enter marks between 0 and 100.", "error");
        return;
      }

      const { error } = await supabase
        .from("marks")
        .upsert(
          {
            student_name: selectedSubmission.student_name,
            class: selectedSubmission.class,
            section: selectedSubmission.section,
            marks: markValue,
            submission_id: selectedSubmission.id,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: "submission_id",
          }
        )

      if (error) throw error;

      await fetchMarks();
      showToast(
        `Marks ${markValue} saved for ${selectedSubmission.student_name}`
      );
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const downloadFile = async (submission: Submission) => {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent))
    element.setAttribute('download', submission.filename)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)

    showToast(`Downloading ${submission.filename}`)
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    let yPosition = 20

    doc.setFontSize(20)
    doc.text('Student Results Report', 20, yPosition)
    yPosition += 15

    doc.setFontSize(12)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition)
    yPosition += 20

    const groupedResults = marks.reduce((acc: any, mark) => {
      const key = `Class ${mark.class} - Section ${mark.section}`
      if (!acc[key]) acc[key] = []
      acc[key].push(mark)
      return acc
    }, {})

    Object.entries(groupedResults).forEach(([group, groupMarks]: [string, any]) => {
      doc.setFontSize(14)
      doc.text(group, 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.text('Student Name', 20, yPosition)
      doc.text('Marks', 120, yPosition)
      yPosition += 8

      doc.line(20, yPosition - 2, 190, yPosition - 2)
      yPosition += 2

      groupMarks.forEach((mark: Mark) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }

        doc.text(mark.student_name, 20, yPosition)
        doc.text(mark.marks.toString(), 120, yPosition)
        yPosition += 8
      })

      yPosition += 10
    })

    doc.save('student-results.pdf')
    showToast("Student results have been downloaded as PDF.")
  }

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.filename.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = !classFilter || submission.class === classFilter
    const matchesSection = !sectionFilter || submission.section === sectionFilter

    return matchesSearch && matchesClass && matchesSection
  })

  const filteredMarks = marks.filter(mark => {
    const matchesClass = !classFilter || mark.class === classFilter
    const matchesSection = !sectionFilter || mark.section === sectionFilter
    return matchesClass && matchesSection
  })

  const uniqueClasses = [...new Set(submissions.map(s => s.class))]
  const uniqueSections = [...new Set(submissions.map(s => s.section))]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
            {toast.message}
          </div>
        )}

        {/* Hero Section */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="text-center text-white">
            <School className="w-24 h-24 mx-auto mb-8 text-white/90" />
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              School Admin Panel
            </h1>
            <p className="text-xl text-white/80 leading-relaxed">
              Manage student submissions, assign marks, and generate comprehensive reports
              with our modern administrative dashboard.
            </p>
            <div className="flex items-center justify-center space-x-8 mt-12">
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-purple-200" />
                <p className="text-sm text-white/70">Submissions</p>
              </div>
              <div className="text-center">
                <Star className="w-8 h-8 mx-auto mb-2 text-purple-200" />
                <p className="text-sm text-white/70">Grading</p>
              </div>
              <div className="text-center">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-purple-200" />
                <p className="text-sm text-white/70">Reports</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl rounded-2xl p-8">
            <div className="text-center space-y-4 mb-8">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-white/20 to-white/10 rounded-full flex items-center justify-center border border-white/20">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Admin Login</h2>
              <p className="text-white/70">
                Enter your credentials to access the admin panel
              </p>
            </div>
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gray-800 border-r border-gray-700 transition-transform z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === 'submissions' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
            >
              <FileText className="w-4 h-4 mr-3" />
              Submissions
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === 'students' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
            >
              <Users className="w-4 h-4 mr-3" />
              Students
            </button>

            <div>
              <button
                onClick={() => setShowFileSettings(!showFileSettings)}
                className="w-full flex items-center px-4 py-3 rounded-lg transition-colors text-gray-300 hover:bg-gray-700/50 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-3" />
                File Settings
                {showFileSettings ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              {showFileSettings && (
                <div className="pl-7 space-y-1 mt-2">
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700/30 rounded">
                    Allowed Extensions
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700/30 rounded">
                    File Size Limits
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 my-4"></div>
            <button
              onClick={signOut}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Top Bar */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-400/30 rounded-full text-sm">
                {user?.email}
              </span>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">
          {activeTab === 'submissions' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by student name or filename..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">All Classes</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>Class {cls}</option>
                    ))}
                  </select>
                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">All Sections</option>
                    {uniqueSections.map(section => (
                      <option key={section} value={section}>Section {section}</option>
                    ))}
                  </select>
                  {(classFilter || sectionFilter || searchQuery) && (
                    <button
                      onClick={() => {
                        setClassFilter('')
                        setSectionFilter('')
                        setSearchQuery('')
                      }}
                      className="flex items-center px-4 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Submissions Table */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-xl font-semibold flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Submissions ({filteredSubmissions.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-4 font-medium text-gray-300">Student</th>
                        <th className="text-left p-4 font-medium text-gray-300">Class</th>
                        <th className="text-left p-4 font-medium text-gray-300">Section</th>
                        <th className="text-left p-4 font-medium text-gray-300">File</th>
                        <th className="text-left p-4 font-medium text-gray-300">Uploaded</th>
                        <th className="text-left p-4 font-medium text-gray-300">Marks</th>
                        <th className="text-left p-4 font-medium text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((submission) => {
                        const existingMark = marks.find(m => m.submission_id === submission.id)
                        return (
                          <tr key={submission.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                            <td className="p-4 font-medium">{submission.student_name}</td>
                            <td className="p-4">{submission.class}</td>
                            <td className="p-4">{submission.section}</td>
                            <td className="p-4">
                              <code className="bg-gray-700 px-2 py-1 rounded text-sm text-purple-300">
                                {submission.filename}
                              </code>
                            </td>
                            <td className="p-4 text-sm text-gray-400">
                              {new Date(submission.uploaded_at).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                              {existingMark ? (
                                <span className="px-2 py-1 bg-green-900/30 text-green-300 border border-green-500/30 rounded text-sm">
                                  {existingMark.marks}/100
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 border border-yellow-500/30 rounded text-sm">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => previewFile(submission)}
                                  className="flex items-center px-3 py-1 text-sm border border-purple-600 text-purple-400 hover:bg-purple-900/20 rounded transition-colors"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Preview
                                </button>
                                <button
                                  onClick={() => downloadFile(submission)}
                                  className="flex items-center px-3 py-1 text-sm border border-blue-600 text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Results Section */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                  <h3 className="text-xl font-semibold flex items-center">
                    <Star className="w-5 h-5 mr-2" />
                    Results ({filteredMarks.length})
                  </h3>
                  <button
                    onClick={generatePDF}
                    className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all transform hover:scale-105"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-4 font-medium text-gray-300">Student</th>
                        <th className="text-left p-4 font-medium text-gray-300">Class</th>
                        <th className="text-left p-4 font-medium text-gray-300">Section</th>
                        <th className="text-left p-4 font-medium text-gray-300">Marks</th>
                        <th className="text-left p-4 font-medium text-gray-300">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMarks.map((mark) => {
                        const grade = mark.marks >= 90 ? 'A+' : mark.marks >= 80 ? 'A' : mark.marks >= 70 ? 'B' : mark.marks >= 60 ? 'C' : 'F'
                        const gradeColor = mark.marks >= 90 ? 'text-green-400' : mark.marks >= 80 ? 'text-blue-400' : mark.marks >= 70 ? 'text-yellow-400' : mark.marks >= 60 ? 'text-orange-400' : 'text-red-400'

                        return (
                          <tr key={mark.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                            <td className="p-4 font-medium">{mark.student_name}</td>
                            <td className="p-4">{mark.class}</td>
                            <td className="p-4">{mark.section}</td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-gray-700 text-white rounded text-sm">
                                {mark.marks}/100
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`font-bold ${gradeColor}`}>
                                {grade}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-semibold mb-2">Students Management</h3>
              <p className="text-gray-400">
                This section is coming soon. Here you'll be able to manage student profiles,
                view their submission history, and track their progress.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  {selectedSubmission.filename}
                </h3>
                <p className="text-gray-400 mt-1">
                  {selectedSubmission.student_name} - Class {selectedSubmission.class}, Section {selectedSubmission.section}
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
              {/* Code Preview */}
              <div className="rounded-lg border border-gray-700 max-h-[60vh] overflow-y-auto scrollbar-hide">
                <pre className="p-4 text-sm bg-gray-900 text-green-400 font-mono whitespace-pre-wrap">
                  {fileContent}
                </pre>
              </div>


              {/* Marks + Save */}
              <div className="flex items-center space-x-4 pt-2 scrollbar-hide">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Enter marks (0-100)"
                    value={markInput}
                    onChange={(e) => setMarkInput(e.target.value)}
                    min="0"
                    max="100"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <button
                  onClick={saveMark}
                  className="flex items-center px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all transform hover:scale-105"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Marks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}