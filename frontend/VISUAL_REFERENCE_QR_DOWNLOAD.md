# Location QR Download Screen - Visual Reference & UI Design

## 📸 Screen Layout Breakdown

### Header Section

```
┌─────────────────────────────────────────────────────┐
│ ← LocationQRDownloads                       🔄      │
│ Download QR codes for all campus locations          │
└─────────────────────────────────────────────────────┘
```

**Components:**

- Back button (arrow-back icon)
- Screen title
- Subtitle describing feature
- Refresh button

### Statistics Bar

```
┌─────────────────────────────────────────────────────┐
│  ✓ Downloaded    │ ⚠ Remaining    │  ☁ All        │
│    5             │    15          │                │
└─────────────────────────────────────────────────────┘
```

**Components:**

- Downloaded count with success icon
- Remaining count with warning icon
- Batch download button
- Dividers between sections

### Content Area - Categories

#### Exit Gates Category

```
┌─────────────────────────────────────────────────────┐
│ 🚪 Exit Gates                               [4]     │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐               │
│  │   Gate 1     │  │   Gate 2     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │     [QR]     │  │     [QR]     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │  Download    │  │  Download    │               │
│  └──────────────┘  └──────────────┘               │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐               │
│  │   Gate 3     │  │   Gate 4     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │     [QR]     │  │     [QR]     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │  Download    │  │  Download    │               │
│  └──────────────┘  └──────────────┘               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Campus Buildings Category

```
┌─────────────────────────────────────────────────────┐
│ 🏢 Campus Buildings                         [8]     │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐               │
│  │   Library    │  │  Auditorium  │               │
│  ├──────────────┤  ├──────────────┤               │
│  │     [QR]     │  │     [QR]     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │  Download    │  │  Download    │               │
│  └──────────────┘  └──────────────┘               │
│                                                     │
│  ... more buildings ...                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Hostels Category

```
┌─────────────────────────────────────────────────────┐
│ 🛏️  Hostels                                    [8]  │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐               │
│  │    BH 1      │  │    BH 2      │               │
│  ├──────────────┤  ├──────────────┤               │
│  │     [QR]     │  │     [QR]     │               │
│  ├──────────────┤  ├──────────────┤               │
│  │  Download    │  │  Download    │               │
│  └──────────────┘  └──────────────┘               │
│                                                     │
│  ... more hostels ...                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Individual QR Card Detail

```
┌─────────────────┐
│   Library       │ ← Location name
├─────────────────┤
│                 │
│      QR         │ ← QR Code (140-160px)
│     CODE        │
│                 │
│   "Library"     │ ← Location label
├─────────────────┤
│   Download ⬇    │ ← Download button
└─────────────────┘
```

**Card Specifications:**

- Width: 48% of screen (2-column grid)
- Aspect ratio: Fits content
- Border radius: 18px
- Background: Card elevated color
- Border: 1px border color

### Info Box

```
┌─────────────────────────────────────────────────────┐
│ ℹ️ Tip: Download all QR codes                      │
├─────────────────────────────────────────────────────┤
│ Use individual download buttons to save QR codes    │
│ to your device. All files are saved to Downloads    │
│ folder.                                             │
└─────────────────────────────────────────────────────┘
```

### Total Stats Box

```
┌─────────────────────────────────────────────────────┐
│                    QR Code                          │
│                    [Icon]                           │
│                                                     │
│              Total Locations                        │
│                    20                               │
│                                                     │
│             5 downloaded                            │
└─────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Light Mode

```
Primary: #007AFF (Apple Blue)
Primary Soft: #E8F1FF (Light blue background)
Success: #34C759 (Apple Green)
Success Soft: #E8F9F0 (Light green background)
Warning: #FF9500 (Apple Orange)
Warning Soft: #FFF0E8 (Light orange background)
Background: #FFFFFF (White)
Card: #F8F9FA (Very light gray)
Border: #E5E5E7 (Light gray)
Text: #000000 (Black)
Text Muted: #666666 (Gray)
```

### Dark Mode

```
Primary: #0A84FF (Bright blue)
Primary Soft: #1A1A2E (Dark blue-gray)
Success: #30B0C0 (Bright green)
Success Soft: #1A2A28 (Dark green-gray)
Warning: #FF9500 (Orange)
Warning Soft: #2A1F10 (Dark orange-gray)
Background: #000000 (Black)
Card: #1C1C1E (Dark gray)
Border: #3A3A3C (Medium gray)
Text: #FFFFFF (White)
Text Muted: #999999 (Light gray)
```

## 📐 Spacing & Layout

```
Header Padding:
  Horizontal: 16px
  Vertical: 12px

Stats Bar:
  Padding: 12px
  Gap between items: 8px

Content:
  Padding: 16px (horizontal), 20px (vertical)
  Gap between sections: 20px

QR Card:
  Width: 48% (mobile)
  Padding: 12px
  Gap in grid: 12px
  Border radius: 18px

Buttons:
  Height: 44px
  Border radius: 12px
  Padding: 12px 16px
```

## 🔤 Typography

### Header

- Title: Bold, 18px
- Subtitle: Regular, 12px

### Category Headers

- Title: Bold, 16px
- Count badge: Bold, 12px

### QR Cards

- Location name: Bold, 13px
- Button text: Bold, 12px

### Stats

- Value: Bold, 16px
- Label: Regular, 11px

## 🎬 Animations & Interactions

### Button Press

```
Download Button:
  Normal: opacity 1.0, background primary color
  Pressed: opacity 0.7
  Loading: Show spinner, disable button
  Completed: Show success message, disable button for 2s
```

### Transitions

```
Screen Entry: Slide from right
Modal: Fade in
Refresh: Rotate refresh icon 360°
```

### Loading States

```
While Downloading:
  Button shows: ActivityIndicator (spinner)
  Button disabled: true
  Opacity: 0.7
```

## 📱 Responsive Design

### Small Devices (< 420px)

```
QR Size: 140px
QR Grid: 2 columns
Content padding: 16px
Card width: 48%
```

### Medium Devices (420-768px)

```
QR Size: 160px
QR Grid: 2 columns
Content padding: 16px
Card width: 48%
```

### Large Devices (> 768px)

```
QR Size: 160px
QR Grid: 2 or 3 columns
Content padding: 20px
Max width: 1000px
```

## 🎯 User Interaction Flow

```
┌─────────────────────────────────────────┐
│  User Opens LocationQRDownloadScreen    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Screen displays all locations by type  │
│  - Exit Gates (4)                       │
│  - Campus Buildings (8)                 │
│  - Hostels (8)                          │
└─────────────────────────────────────────┘
                    ↓
        ┌───────────────────┬────────────────┐
        ↓                   ↓                ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Tap Download │   │ View History │   │ Tap Refresh  │
│ on a QR code │   │ of files     │   │ to reset     │
└──────────────┘   └──────────────┘   └──────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Request Storage Permission (Android)   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Capture QR Code Image                  │
│  Generate Filename                      │
│  Save to Downloads Folder               │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│  Show Success Message                   │
│  Update Download Stats                  │
│  Increment Downloaded Count             │
└─────────────────────────────────────────┘
```

## 🔔 User Feedback Messages

### Success

```
"✓ QR Downloaded"
"Gate 1 QR saved as:
 aegis-location-qr-gate-1-2024-01-15-143025.png"
```

### Error

```
"✗ Download Failed"
"Could not save Gate 1 QR.
 Storage permission denied"
```

### Confirmation

```
"Folder access is required to save the QR file"
[Cancel] [Open Settings]
```

## 📊 Statistics Display

### Download Stats Bar

```
Success Icon (Green)     Warning Icon (Orange)    Button
     ✓                        ⚠                    ☁
  Downloaded              Remaining              All
     5                        15
```

### Total Stats Box

```
           QR Code Icon
                ⊕

    Total Locations
           20

     5 downloaded
```

## 🎨 Icon Usage

- **Back**: arrow-back (24px)
- **Refresh**: refresh-outline (20px)
- **Download**: download-outline (16px, in button)
- **Exit Gates**: exit-outline (24px)
- **Buildings**: business-outline (24px)
- **Hostels**: bed-outline (24px)
- **Info**: information-circle-outline (20px)
- **Success**: checkmark-circle (20px)
- **Warning**: alert-circle (20px)
- **QR Code**: qr-code-outline (28px)
- **Cloud Download**: cloud-download-outline (16px, in button)
- **Chevron**: chevron-forward (20px)

## 📏 Dimensions

### Screen

- Full width: 100vw
- Full height: 100vh
- Safe area top (with status bar)
- Safe area bottom (with home indicator on notched devices)

### Header

- Height: Auto (content driven)
- Min height: 60px

### Stats Bar

- Height: 64px
- Divider width: 1px
- Divider height: 40px

### QR Card

- Width: 48% (minus gap)
- Height: Auto (content driven)
- Min height: 280px
- Border radius: 18px

### QR Code Image

- Size: 140px or 160px (depending on screen width)
- Format: PNG
- Background: White
- Quiet zone: 8px padding

## 🎯 Accessibility Features

- **Colors**: Use sufficient contrast (WCAG AA)
- **Text**: Readable font sizes (min 12px)
- **Icons**: Paired with text labels
- **Buttons**: Minimum 44px touch target
- **Loading**: Clear feedback during operations
- **Errors**: Clear, actionable error messages

## 🖼️ Dark Mode Behavior

All components automatically adapt:

- Text colors invert
- Background colors invert
- Icon colors adjust
- QR code stays white (for scanability)
- Borders adapt to dark background
- Cards have appropriate dark elevation

## 📱 Sample Screenshots Dimensions

```
iPhone SE (375px width):
- Header: 375px × 80px
- Stats bar: 375px × 64px
- QR card: 180px × 240px (2 columns with gap)

iPhone 12 Pro (390px width):
- Header: 390px × 80px
- Stats bar: 390px × 64px
- QR card: 185px × 240px (2 columns with gap)

iPad (768px width):
- Header: 768px × 80px
- Stats bar: 768px × 64px
- QR card: 360px × 300px (2 columns with gap)
```

---

## 🎬 Complete User Journey

```
Start
  ↓
Open Location QR Download
  ↓
See 3 Categories (Gates, Buildings, Hostels)
  ↓
Each shows 2-column grid of QR cards
  ↓
Stats bar shows: Downloaded, Remaining, All button
  ↓
User taps Download on any location
  ↓
Button shows loading spinner
  ↓
Storage permission granted (Android)
  ↓
QR code captured and saved
  ↓
Success message shows
  ↓
Download count increments
  ↓
File saved to Downloads folder
  ↓
User can download more or manage files
  ↓
End
```

---

This visual guide provides a complete picture of the Location QR Download screen's appearance and user experience!
