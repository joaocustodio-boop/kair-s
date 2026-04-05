import {
  createIcons,
  Wallet, Sparkles, Dumbbell, StickyNote, Calendar, Briefcase, FileText,
  Sun, Moon, Bell, Menu, Zap, Pill, Droplets, Video, ChevronLeft, Home, User,
  Plus, Trash2, Pen, X, Check, Save, ArrowLeft,
  DollarSign, TrendingUp, TrendingDown, PiggyBank,
  CircleCheck, CircleAlert, Star, Flame,
  Search, Tag, Clock, MapPin,
  Activity, Heart, BookOpen, Ellipsis, Pin,
  ChevronRight, ChevronDown, ChevronUp,
  ChartBar, Pencil, Circle, SlidersHorizontal, Info,
  SkipBack, SkipForward, Play, Pause, ListMusic, PlayCircle,
  Music, Music2, Volume2, Loader,
  ImageOff, Barcode, Package, AlertTriangle, SearchX
} from 'lucide';

export const allIcons = {
  Wallet, Sparkles, Dumbbell, StickyNote, Calendar, Briefcase, FileText,
  Sun, Moon, Bell, Menu, Zap, Pill, Droplets, Video, ChevronLeft, Home, User,
  Plus, Trash2, Pen, X, Check, Save, ArrowLeft,
  DollarSign, TrendingUp, TrendingDown, PiggyBank,
  CircleCheck, CircleAlert, Star, Flame,
  Search, Tag, Clock, MapPin,
  Activity, Heart, BookOpen, Ellipsis, Pin,
  ChevronRight, ChevronDown, ChevronUp,
  ChartBar, Pencil, Circle, SlidersHorizontal, Info,
  SkipBack, SkipForward, Play, Pause, ListMusic, PlayCircle,
  Music, Music2, Volume2, Loader,
  ImageOff, Barcode, Package, AlertTriangle, SearchX
};

export function refreshIcons() {
  createIcons({ icons: allIcons });
}
