# Translation Setup Guide

## Overview
The application now supports full internationalization (i18n) with translations loaded from JSON files on the server side.

## Architecture

### Frontend (Angular)
- **TranslationService**: Wrapper service for TranslateService with user language initialization
- **ApiTranslateLoader**: Custom loader that fetches translations from the backend API
- **TranslateModule**: ngx-translate module integrated throughout the app
- **Translation Keys**: All user-facing text uses translation keys

### Backend (Rust)
- **Translation Handler**: Serves translation JSON files from `./translations/` directory
- **JSON Files**: Translation files stored as `{language}.json` (e.g., `en.json`, `de.json`, `sk.json`)

## Translation Files Location
Translation JSON files are stored in: `susm-be/translations/`

## Supported Languages
- English (`en`)
- German (`de`)
- Slovak (`sk`)

## Translation Key Structure
Translation keys follow a hierarchical structure:
```
{section}.{item}
```

Examples:
- `common.submit` - Common submit button
- `login.title` - Login page title
- `projects.addNew` - Add new project button
- `errors.uploadFailed` - Upload error message

## Usage in Templates

### Basic Translation
```html
<h1>{{ 'projects.title' | translate }}</h1>
```

### Translation with Placeholder
```html
<input [placeholder]="'login.emailPlaceholder' | translate" />
```

### Translation in Attributes
```html
<button [attr.aria-label]="'objects.add' | translate">
```

## Usage in TypeScript

### Using TranslationService
```typescript
import { TranslationService } from '@services/translation.service';

export class MyComponent {
  #translationService = inject(TranslationService);

  showMessage() {
    const message = this.#translationService.instant('errors.uploadFailed');
    // Use message...
  }
}
```

### Using Observable
```typescript
this.#translationService.get('projects.title').subscribe(title => {
  // Use title...
});
```

## Adding New Translations

1. **Add translation key to all language files** in `susm-be/translations/`:
   - `en.json`
   - `de.json`
   - `sk.json`

2. **Use the key in your template or component**:
   ```html
   {{ 'my.new.key' | translate }}
   ```

3. **Translation files structure**:
   ```json
   {
     "language": "en",
     "translations": {
       "my.new.key": "My translated text"
     }
   }
   ```

## Translation Key Categories

### Common (`common.*`)
- `submit`, `cancel`, `save`, `delete`, `edit`, `close`
- `loading`, `error`, `success`, `search`

### Navigation (`navbar.*`)
- `dashboard`, `projects`, `streets`, `objects`
- `logout`, `login`, `register`, `logo`

### Authentication (`login.*`, `register.*`)
- Login and registration form labels and placeholders
- User, address, and company fields

### Projects (`projects.*`)
- Project-related labels and messages

### Objects (`objects.*`)
- Object-related labels and messages
- File upload messages

### Languages (`languages.*`)
- Language names for selection

### Errors (`errors.*`)
- Error messages throughout the application

## Backend API

### Endpoint
```
GET /translations/{lang}
```

### Response Format
```json
{
  "language": "en",
  "translations": {
    "key1": "Translation 1",
    "key2": "Translation 2"
  }
}
```

### Example Request
```bash
curl http://localhost:8080/translations/en
```

## Language Selection

The application automatically uses the user's preferred language from their profile. If no language is set, it defaults to English.

To change language programmatically:
```typescript
this.#translationService.use('de'); // Switch to German
```

## Best Practices

1. **Always use translation keys** - Never hardcode user-facing text
2. **Use descriptive keys** - Follow the `{section}.{item}` pattern
3. **Keep keys consistent** - Use the same key structure across similar features
4. **Update all languages** - When adding a new key, add it to all language files
5. **Test translations** - Verify all languages display correctly
6. **Use common keys** - Reuse common translations like buttons and labels

## Files Modified

### Frontend
- All component HTML templates
- Component TypeScript files (added TranslateModule imports)
- `app.ts` - Initializes translations
- `loaders/api-translate-loader.ts` - Updated to handle JSON response
- `services/translation.service.ts` - New service for translation management

### Backend
- `handlers/translations/mod.rs` - Updated to serve JSON files
- `translations/*.json` - Translation files for each language

## Next Steps

1. Add more translation keys as needed
2. Add more languages by creating new JSON files
3. Consider adding a language switcher UI component
4. Add translation validation/fallback mechanisms
5. Consider lazy-loading translations for better performance

