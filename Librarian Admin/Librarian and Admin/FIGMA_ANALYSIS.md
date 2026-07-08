# BookHive Figma Design Analysis

## Overview
- **Document**: Bookhive
- **Total Pages**: 3
- **Analysis Scope**: Pages 2 & 3 (UI indices 1 & 2)
- **Report Date**: 2026-05-15 17:00:48

## Page 2: Home Page
### Main Frame
- **Name**: BookHive: Home (Fixed Height)
- **Dimensions**: 1280 x 1024 pixels
- **Background**: RGB(15, 29, 41) - Dark Navy Blue
- **Children**: 8 main components

### Component Breakdown

#### 1. Header - TopAppBar
- **Type**: Frame (HORIZONTAL layout)
- **Dimensions**: 1000 x 64
- **Background**: RGB(0, 32, 59)
- **Layout Mode**: Horizontal
- **Contains**:
  - Branding: 'BOOKHIVE librarian' (White text)
  - Notification Icon (16x20, White)
  - User Avatar Container (36x36, Light background RGB(241, 245, 249))

#### 2. Main Search Section
- **Background Container**: RGB(38, 66, 88)
- **Tagline**: 'Find resources across the entire STI WNU digital ecosystem.'
- **Search Input Placeholder**: 'search by title, author, ISBN or ask a question...'
- **Placeholder Text Color**: RGB(148, 163, 184)

#### 3. Librarian Command Desk
- **Section Title**: 'LIBRARIAN COMMAND DESK' (RGB(252, 212, 0) - Gold)
- **Action Buttons**:
  - 'BOOKHIVE LIBRARIAN' (Steel Blue: RGB(100, 116, 139))
  - '3 pending requests' (Steel Blue: RGB(100, 116, 139))
- **Button Styling**: Fully rounded corners (border-radius: 9999)

#### 4. Category Filter Buttons
- **Default Color**: RGB(48, 69, 87)
- **Active/Hover Color**: RGB(58, 95, 120)
- **Text Color**: RGB(255, 255, 255) - White
- **Border Radius**: 25 pixels
- **Categories**:
  - Computer Science (Currently Active/Highlighted)
  - Engineering
  - Education
  - Business & Accountancy
  - Arts

### Color Palette (Page 2)
| Color Name | RGB Value | Usage |
|:--|:--|:--|
| Dark Navy | RGB(15, 29, 41) | Background |
| Header Blue | RGB(0, 32, 59) | Header background |
| Container Blue | RGB(38, 66, 88) | Content containers |
| Steel Blue | RGB(100, 116, 139) | Buttons |
| Active Blue | RGB(58, 95, 120) | Active button state |
| Accent Gold | RGB(252, 212, 0) | Section titles |
| Text White | RGB(255, 255, 255) | Primary text |
| Text Gray | RGB(148, 163, 184) | Secondary/placeholder text |
| Light | RGB(241, 245, 249) | Avatar background |

### Layout System
- **Framework**: Flexbox (Horizontal/Vertical)
- **Primary Axis**: FIXED sizing
- **Counter Axis**: FIXED sizing
- **Nesting**: Multi-level container structure
- **Border Radius Patterns**:
  - Buttons: 25px (rounded)
  - Pill buttons: 9999px (fully rounded)
  - Containers: 23-30px (rounded corners)

## Page 3: Reports Page
### Overview
- Reports functionality for library analytics
- Borrowing trends visualization
- Department demand comparison
- Admin review and export capabilities

### Key Sections
- **Section Title**: 'REPORTS'
- **Description**: 'Descriptive analytics for library performance'
- **Tagline**: 'Visualize borrowing trends, compare department demand, and export clean analytics for admin review and printing.'

### Report Card Components
- **Total Borrows** card
- Multiple analytics cards with:
  - Background: RGB(48, 69, 87)
  - Opacity: 82%
  - Border Radius: 10px
  - Dimensions: 299 x 70 pixels (standard)

## Design System Key Findings

### Typography
- Headlines use various font sizes
- Font Family: System default fonts
- All text is either white or muted gray for contrast

### Spacing & Dimensions
- Consistent padding in containers
- Standard button height: 37 pixels
- Standard button width: 199 pixels (variable)
- Card height: 45 pixels (filter buttons)
- Search box height: 95 pixels

### Interactive Elements
- **Buttons**: All use rounded corners (25-9999px radius)
- **States**: Active state uses lighter blue (RGB(58, 95, 120))
- **Avatar**: Pill-shaped with light background
- **Search Input**: Large container with rounded corners

### Accessibility Notes
- Good contrast between text and background
- White text on dark backgrounds
- Gold accents for important actions
- Clear button labeling

## Data Export Information
- **Full Detailed Report**: 11,739 lines
- **File Size**: ~502KB
- **Includes**: All node hierarchies, properties, dimensions, colors

## Recommendations for Rebuilding UI
1. Use the RGB color values provided for consistent styling
2. Implement flexbox layout with FIXED sizing for main containers
3. Use 25px border radius for standard buttons, 9999px for pill buttons
4. Maintain text contrast ratios (white on dark blues)
5. Implement active/hover states using the lighter blue shade
6. Size buttons to 199px width for consistency
7. Use nested frame structure for component organization

---
Generated from Figma API extraction
