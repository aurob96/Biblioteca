import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import {
  Barcode,
  BookOpen,
  Camera,
  Check,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  Library,
  List,
  Menu,
  Map as MapIcon,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Square,
  Tags,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { api } from "./api";
import guardaLogo from "./assets/guarda-logo.svg";
import type {
  AvailabilityStatus,
  Book,
  BookPayload,
  ClassificationPayload,
  DuplicateMatch,
  DeweyGenreSuggestion,
  ExternalBookMetadata,
  Genre,
  ReadingStatus,
  ReorganizationReport,
  ReorganizationSuggestion,
  Shelf
} from "./types";

const initialBookForm: BookPayload = {
  title: "",
  authors: [""],
  subtitle: "",
  isbn10: "",
  isbn13: "",
  publisher: "",
  publicationYear: "",
  pageCount: "",
  genre: "",
  genreId: "",
  subgenreId: "",
  deweyGenreRaw: "",
  languageCode: "es",
  synopsis: "",
  edition: "",
  coverUrl: "",
  deweyCode: "",
  deweyHierarchy: [],
  deweyExplanation: "",
  lcCode: "",
  lcHierarchy: [],
  lcExplanation: "",
  customTags: [],
  labelSerial: "",
  labelSystem: "DEWEY",
  labelSize: "MEDIANO",
  availabilityStatus: "EN_MI_BIBLIOTECA",
  readingStatus: "SIN_ESTADO",
  isReference: false,
  shelfId: "",
  shelfSectionId: ""
};

const emptyClassification: ClassificationPayload = {
  deweyCode: "",
  deweyHierarchy: [],
  deweyExplanation: "",
  lcCode: "",
  lcHierarchy: [],
  lcExplanation: "",
  customTags: []
};

function formatAvailability(value: AvailabilityStatus) {
  return value === "PRESTADO" ? "Prestado" : "En mi biblioteca";
}

function formatReading(value: ReadingStatus) {
  if (value === "LEIDO") return "Leido";
  if (value === "POR_LEER") return "Por leer";
  return "Sin estado";
}

function authorsLine(book: Book) {
  return book.authors.map((author) => author.fullName).join(", ");
}

export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [subgenreFilter, setSubgenreFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"menu" | "book" | "classification" | "labels" | "loan">("menu");
  const [activeView, setActiveView] = useState<"catalog" | "book-flow" | "management" | "map" | "assistant">("catalog");
  const [bookFlowStep, setBookFlowStep] = useState(1);
  const [bookEntryMethod, setBookEntryMethod] = useState<"scan" | "isbn" | "search" | "manual" | "">("");
  const [openBookMenuId, setOpenBookMenuId] = useState("");
  const [openToolSections, setOpenToolSections] = useState(["scan", "book"]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bookForm, setBookForm] = useState<BookPayload>(initialBookForm);
  const [deweyGenreSuggestion, setDeweyGenreSuggestion] = useState<DeweyGenreSuggestion | null>(null);
  const [pendingBookPayload, setPendingBookPayload] = useState<BookPayload | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [editingBookId, setEditingBookId] = useState("");
  const [isbnLookup, setIsbnLookup] = useState("");
  const [bookSearchForm, setBookSearchForm] = useState({ title: "", author: "", publisher: "", year: "" });
  const [bookSearchResults, setBookSearchResults] = useState<ExternalBookMetadata[]>([]);
  const [scanStatus, setScanStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isBookSearching, setIsBookSearching] = useState(false);
  const [classificationBook, setClassificationBook] = useState<Book | null>(null);
  const [classificationDraft, setClassificationDraft] = useState<ClassificationPayload>(emptyClassification);
  const [isClassifying, setIsClassifying] = useState(false);
  const [genreForm, setGenreForm] = useState({ name: "", color: "#461e60", icon: "ti-book" });
  const [subgenreForm, setSubgenreForm] = useState({ genreId: "", name: "" });
  const [editingGenreId, setEditingGenreId] = useState("");
  const [editingSubgenreId, setEditingSubgenreId] = useState("");
  const [shelfForm, setShelfForm] = useState({ name: "", homeLocation: "", description: "", mapX: 80, mapY: 80, mapWidth: 130, mapHeight: 72, capacity: 40 });
  const [sectionForm, setSectionForm] = useState({ shelfId: "", name: "", position: 1, genreId: "" });
  const [editingShelfId, setEditingShelfId] = useState("");
  const [editingSectionId, setEditingSectionId] = useState("");
  const [openShelfMenuId, setOpenShelfMenuId] = useState("");
  const [loanForm, setLoanForm] = useState({ bookId: "", borrowerName: "", borrowerContact: "", dueAt: "", notes: "" });
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [labelBookId, setLabelBookId] = useState("");
  const [labelSystem, setLabelSystem] = useState<"DEWEY" | "LC" | "PROPIA">("DEWEY");
  const [labelSize, setLabelSize] = useState<"PEQUENO" | "MEDIANO" | "PERSONALIZADO">("MEDIANO");
  const [labelWidth, setLabelWidth] = useState(3);
  const [labelHeight, setLabelHeight] = useState(4);
  const [labelPageSize, setLabelPageSize] = useState<"letter" | "A4">("letter");
  const [labelColumns, setLabelColumns] = useState(4);
  const [includeShelfOnLabel, setIncludeShelfOnLabel] = useState(true);
  const [labelSerialDraft, setLabelSerialDraft] = useState("");
  const [selectedMapShelfId, setSelectedMapShelfId] = useState("");
  const [highlightedShelfId, setHighlightedShelfId] = useState("");
  const [draggingShelfId, setDraggingShelfId] = useState("");
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [reorganizationReport, setReorganizationReport] = useState<ReorganizationReport | null>(null);
  const [acceptedSuggestionId, setAcceptedSuggestionId] = useState("");
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const selectedShelf = useMemo(
    () => shelves.find((shelf) => shelf.id === bookForm.shelfId),
    [bookForm.shelfId, shelves]
  );
  const selectedShelfSection = useMemo(
    () => selectedShelf?.sections.find((section) => section.id === bookForm.shelfSectionId),
    [bookForm.shelfSectionId, selectedShelf]
  );
  const selectedBookGenre = useMemo(
    () => genres.find((genre) => genre.id === bookForm.genreId),
    [bookForm.genreId, genres]
  );
  const selectedBookSubgenres = selectedBookGenre?.subgenres ?? [];
  const filterSubgenres = genreFilter
    ? genres.find((genre) => genre.id === genreFilter)?.subgenres ?? []
    : genres.flatMap((genre) => genre.subgenres);
  const selectedSectionGenreMismatch = Boolean(
    selectedShelfSection?.genreId && bookForm.genreId && selectedShelfSection.genreId !== bookForm.genreId
  );
  const labelBook = useMemo(() => books.find((book) => book.id === labelBookId) ?? null, [books, labelBookId]);
  const selectedBooks = useMemo(
    () => books.filter((book) => selectedBookIds.includes(book.id)),
    [books, selectedBookIds]
  );
  const selectedMapShelf = useMemo(
    () => shelves.find((shelf) => shelf.id === selectedMapShelfId) ?? null,
    [selectedMapShelfId, shelves]
  );
  const selectedMapShelfBooks = useMemo(
    () => books.filter((book) => book.shelf?.id === selectedMapShelfId),
    [books, selectedMapShelfId]
  );
  const booksBySection = useMemo(() => {
    const groups = new Map<string, Book[]>();
    for (const book of selectedMapShelfBooks) {
      const key = book.shelfSection?.id ?? "sin-repisa";
      groups.set(key, [...(groups.get(key) ?? []), book]);
    }
    return groups;
  }, [selectedMapShelfBooks]);
  const acceptedSuggestion = useMemo(
    () => reorganizationReport?.suggestions.find((suggestion) => suggestion.id === acceptedSuggestionId) ?? null,
    [acceptedSuggestionId, reorganizationReport]
  );

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100"
      });
      if (query.trim()) params.set("q", query.trim());
      if (genreFilter) params.set("genreId", genreFilter);
      if (subgenreFilter) params.set("subgenreId", subgenreFilter);
      if (shelfFilter) params.set("shelfId", shelfFilter);
      params.set("sort", sortOrder);

      const [bookResult, shelfResult, genreResult] = await Promise.all([api.listBooks(params), api.listShelves(), api.listGenres()]);
      setBooks(bookResult.items);
      setTotal(bookResult.total);
      setShelves(shelfResult.items);
      setGenres(genreResult.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(loadData, 250);
    return () => window.clearTimeout(id);
  }, [query, genreFilter, subgenreFilter, shelfFilter, sortOrder]);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  function cleanIsbn(value: string) {
    return value.replace(/[^0-9X]/gi, "").toUpperCase();
  }

  function applyExternalBook(metadata: ExternalBookMetadata) {
    const suggestion = metadata.genreSuggestion ?? null;
    setDeweyGenreSuggestion(suggestion);
    setBookForm((current) => ({
      ...current,
      title: metadata.title ?? current.title,
      authors: metadata.authors?.length ? metadata.authors : current.authors,
      isbn10: metadata.isbn10 ?? current.isbn10,
      isbn13: metadata.isbn13 ?? current.isbn13,
      publisher: metadata.publisher ?? current.publisher,
      publicationYear: metadata.publicationYear ?? current.publicationYear,
      pageCount: metadata.pageCount ?? current.pageCount,
      genre: metadata.genre ?? current.genre,
      genreId: suggestion?.confianza === "alta" && suggestion.genreId ? suggestion.genreId : current.genreId,
      subgenreId: suggestion?.confianza === "alta" && suggestion.subgenreId ? suggestion.subgenreId : current.subgenreId,
      deweyGenreRaw: [metadata.deweyCode, ...(metadata.subjects ?? [])].filter(Boolean).join(" | ") || metadata.genre || current.deweyGenreRaw,
      deweyCode: metadata.deweyCode ?? current.deweyCode,
      languageCode: metadata.languageCode ?? current.languageCode,
      synopsis: metadata.synopsis ?? current.synopsis,
      coverUrl: metadata.coverUrl ?? current.coverUrl
    }));
  }

  function applyDeweyGenreSuggestion() {
    if (!deweyGenreSuggestion) return;
    setBookForm((current) => ({
      ...current,
      genre: deweyGenreSuggestion.genero_principal,
      genreId: deweyGenreSuggestion.genreId ?? current.genreId,
      subgenreId: deweyGenreSuggestion.subgenreId ?? "",
      deweyGenreRaw: current.deweyGenreRaw || deweyGenreSuggestion.razon
    }));
    setMessage("Genero sugerido aplicado. Puedes ajustarlo antes de guardar.");
  }

  function splitLines(value: string) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitTags(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function classificationFromBook(book: Book): ClassificationPayload {
    return {
      deweyCode: book.deweyCode ?? "",
      deweyHierarchy: book.deweyHierarchy ?? [],
      deweyExplanation: book.deweyExplanation ?? "",
      lcCode: book.lcCode ?? "",
      lcHierarchy: book.lcHierarchy ?? [],
      lcExplanation: book.lcExplanation ?? "",
      customTags: book.customTags ?? []
    };
  }

  function classificationFromForm(): ClassificationPayload {
    return {
      deweyCode: bookForm.deweyCode ?? "",
      deweyHierarchy: bookForm.deweyHierarchy ?? [],
      deweyExplanation: bookForm.deweyExplanation ?? "",
      lcCode: bookForm.lcCode ?? "",
      lcHierarchy: bookForm.lcHierarchy ?? [],
      lcExplanation: bookForm.lcExplanation ?? "",
      customTags: bookForm.customTags ?? []
    };
  }

  function openClassificationAssistant(book?: Book) {
    setClassificationBook(book ?? null);
    if (book) {
      setEditingBookId(book.id);
      setBookForm(bookToForm(book));
      setActiveView("catalog");
      setIsToolsOpen(true);
      setDrawerMode("classification");
      setOpenToolSections(["classification"]);
      setOpenBookMenuId("");
    }
    setClassificationDraft(book ? classificationFromBook(book) : classificationFromForm());
    setMessage(book ? `Clasificando "${book.title}"` : "Clasificando el libro del formulario");
    setError("");
  }

  function applyClassificationToForm(payload: ClassificationPayload) {
    setBookForm((current) => ({
      ...current,
      deweyCode: payload.deweyCode ?? "",
      deweyHierarchy: payload.deweyHierarchy,
      deweyExplanation: payload.deweyExplanation ?? "",
      lcCode: payload.lcCode ?? "",
      lcHierarchy: payload.lcHierarchy,
      lcExplanation: payload.lcExplanation ?? "",
      customTags: payload.customTags,
      genre: payload.suggestedGenre ?? current.genre,
      genreId: payload.genreId ?? current.genreId,
      subgenreId: payload.subgenreId ?? current.subgenreId
    }));
  }

  async function suggestClassification() {
    const source = classificationBook;
    const title = source?.title ?? bookForm.title;
    const authors = source?.authors.map((author) => author.fullName) ?? bookForm.authors.filter(Boolean);
    const genre = source?.genre ?? bookForm.genre;
    const synopsis = source?.synopsis ?? bookForm.synopsis;

    if (!title.trim()) {
      setError("Agrega un titulo antes de pedir una clasificacion");
      return;
    }

    setError("");
    setMessage("");
    setIsClassifying(true);
    try {
      const suggestion = await api.suggestClassification({ title, authors, genre, synopsis });
      setClassificationDraft(suggestion);
      setMessage("Sugerencia generada. Puedes editarla antes de aceptar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function classifyFormBook() {
    const title = bookForm.title.trim();
    if (!title) return;
    setIsClassifying(true);
    setError("");
    try {
      const suggestion = await api.suggestClassification({
        title,
        authors: bookForm.authors.filter(Boolean),
        genre: bookForm.genre,
        synopsis: bookForm.synopsis
      });
      setClassificationDraft(suggestion);
      applyClassificationToForm(suggestion);
      setMessage("Clasificacion y genero sugeridos aplicados. Puedes ajustar antes de guardar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function startBookClassification(book: Book) {
    openClassificationAssistant(book);
    setIsClassifying(true);
    setError("");
    try {
      const suggestion = await api.suggestClassification({
        title: book.title,
        authors: book.authors.map((author) => author.fullName),
        genre: book.genre ?? undefined,
        synopsis: book.synopsis ?? undefined
      });
      setClassificationDraft(suggestion);
      setMessage("Sugerencia generada. Puedes editarla antes de continuar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function acceptClassification() {
    setError("");
    setMessage("");
    try {
      if (classificationBook) {
        const updated = await api.saveClassification(classificationBook.id, classificationDraft);
        setClassificationBook(updated);
        setMessage("Clasificacion guardada en el libro");
        await loadData();
      } else {
        applyClassificationToForm(classificationDraft);
        setMessage("Clasificacion aplicada al formulario. Revisa y guarda el libro.");
      }
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo guardar la clasificacion");
    }
  }

  async function lookupIsbn(isbnValue: string) {
    const isbn = cleanIsbn(isbnValue);
    if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) {
      setError("El ISBN debe tener 10 o 13 caracteres validos");
      return;
    }

    setError("");
    setMessage("");
    setIsLookupLoading(true);
    try {
      const metadata = await api.lookupIsbn(isbn);
      applyExternalBook(metadata);
      setIsbnLookup(isbn);
      setBookFlowStep(2);
      void checkDuplicates({
        ...bookForm,
        title: metadata.title,
        authors: metadata.authors?.length ? metadata.authors : bookForm.authors,
        isbn10: metadata.isbn10 ?? bookForm.isbn10,
        isbn13: metadata.isbn13 ?? bookForm.isbn13
      } as BookPayload);
      setMessage(`Datos importados desde ${metadata.source === "open_library" ? "Open Library" : "Google Books"}. Revisa el formulario antes de guardar.`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "No se encontraron datos para ese ISBN");
      setBookForm((current) => ({
        ...current,
        isbn10: isbn.length === 10 ? isbn : current.isbn10,
        isbn13: isbn.length === 13 ? isbn : current.isbn13
      }));
    } finally {
      setIsLookupLoading(false);
    }
  }

  async function searchBooksWithoutIsbn() {
    const title = bookSearchForm.title.trim();
    if (title.length < 2) {
      setError("Escribe al menos 2 caracteres del titulo");
      return;
    }

    setError("");
    setMessage("");
    setIsBookSearching(true);
    try {
      const result = await api.searchExternalBooks({
        title,
        author: bookSearchForm.author,
        publisher: bookSearchForm.publisher,
        year: bookSearchForm.year
      });
      setBookSearchResults(result.items);
      setMessage(result.items.length ? "Elige una opcion para completar el formulario." : "No encontre resultados publicos para esa busqueda.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar el libro");
    } finally {
      setIsBookSearching(false);
    }
  }

  function useExternalBookResult(metadata: ExternalBookMetadata) {
    applyExternalBook(metadata);
    setBookSearchResults([]);
    setBookFlowStep(2);
    void checkDuplicates({
      ...bookForm,
      title: metadata.title,
      authors: metadata.authors?.length ? metadata.authors : bookForm.authors,
      isbn10: metadata.isbn10 ?? bookForm.isbn10,
      isbn13: metadata.isbn13 ?? bookForm.isbn13
    } as BookPayload);
    setMessage(`Datos importados desde ${metadata.source === "open_library" ? "Open Library" : "Google Books"}. Revisa el formulario antes de guardar.`);
  }

  async function startScanner() {
    if (!videoRef.current) {
      return;
    }

    setError("");
    setMessage("");
    setScanStatus("Solicitando acceso a la camara...");
    setIsScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();
      scannerControlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result, _error, controls) => {
          const text = result?.getText();
          if (!text) {
            return;
          }

          const isbn = cleanIsbn(text);
          if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) {
            setScanStatus(`Codigo detectado, pero no parece ISBN: ${text}`);
            return;
          }

          controls.stop();
          scannerControlsRef.current = null;
          setIsScanning(false);
          setScanStatus(`ISBN detectado: ${isbn}`);
          void lookupIsbn(isbn);
        }
      );
      setScanStatus("Apunta la camara al codigo de barras ISBN");
    } catch (scanError) {
      setIsScanning(false);
      scannerControlsRef.current = null;
      setError(scanError instanceof Error ? scanError.message : "No se pudo iniciar la camara");
      setScanStatus("");
    }
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setIsScanning(false);
    setScanStatus("");
  }

  function normalizedBookPayload(): BookPayload {
    const draft = {
      ...bookForm,
      authors: bookForm.authors.map((author) => author.trim()).filter(Boolean),
      publicationYear: bookForm.publicationYear === "" ? undefined : Number(bookForm.publicationYear),
      pageCount: bookForm.pageCount === "" ? undefined : Number(bookForm.pageCount)
    };
    return {
      ...draft,
      labelSerial: draft.labelSerial || generateLabelSerialFromForm()
    };
  }

  async function checkDuplicates(payload: BookPayload) {
    if (!payload.title.trim() || payload.authors.length === 0 || editingBookId) {
      return [];
    }

    const result = await api.findDuplicates({
      title: payload.title,
      authors: payload.authors,
      isbn10: payload.isbn10,
      isbn13: payload.isbn13
    });

    if (result.matches.length > 0) {
      setDuplicateMatches(result.matches);
      setPendingBookPayload(payload);
      return result.matches;
    }

    return [];
  }

  async function saveBookPayload(payload: BookPayload, forceCreate = false) {
    setError("");
    setMessage("");
    try {
      if (!editingBookId && !forceCreate) {
        const matches = await checkDuplicates(payload);
        if (matches.length > 0) {
          setMessage("Encontramos posibles duplicados antes de guardar");
          return;
        }
      }

      if (editingBookId) {
        await api.updateBook(editingBookId, payload);
      } else {
        await api.createBook(payload);
      }
      setBookForm(initialBookForm);
      setDeweyGenreSuggestion(null);
      setEditingBookId("");
      setIsbnLookup("");
      setPendingBookPayload(null);
      setDuplicateMatches([]);
      setActiveView("catalog");
      setIsToolsOpen(false);
      setDrawerMode("menu");
      setBookFlowStep(1);
      setBookEntryMethod("");
      setMessage(editingBookId ? "Libro actualizado" : "Libro agregado al catalogo");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el libro");
    }
  }

  async function submitBook(event: FormEvent) {
    event.preventDefault();
    await saveBookPayload(normalizedBookPayload());
  }

  function startNewBookFlow() {
    stopScanner();
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setDuplicateMatches([]);
    setPendingBookPayload(null);
    setBookSearchResults([]);
    setIsbnLookup("");
    setBookEntryMethod("");
    setBookFlowStep(1);
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("book");
    setOpenToolSections(["scan", "book"]);
    setMessage("");
    setError("");
  }

  function cancelBookFlow() {
    stopScanner();
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setDuplicateMatches([]);
    setPendingBookPayload(null);
    setBookSearchResults([]);
    setBookFlowStep(1);
    setBookEntryMethod("");
    setActiveView("catalog");
    setIsToolsOpen(false);
    setDrawerMode("menu");
    setMessage("");
    setError("");
  }

  function chooseBookEntryMethod(method: "scan" | "isbn" | "search" | "manual") {
    setBookEntryMethod(method);
    if (method === "manual") {
      setBookFlowStep(2);
    }
  }

  async function addDuplicateAnyway() {
    if (!pendingBookPayload) return;
    await saveBookPayload(pendingBookPayload, true);
  }

  async function updateDuplicateExisting(match: DuplicateMatch) {
    if (!pendingBookPayload) return;
    setError("");
    setMessage("");
    try {
      await api.updateBook(match.book.id, pendingBookPayload);
      setBookForm(initialBookForm);
      setDeweyGenreSuggestion(null);
      setPendingBookPayload(null);
      setDuplicateMatches([]);
      setMessage("Libro existente actualizado con la informacion nueva");
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el libro existente");
    }
  }

  function cancelDuplicateSave() {
    setPendingBookPayload(null);
    setDuplicateMatches([]);
    setMessage("Guardado cancelado");
  }

  async function submitShelf(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingShelfId) {
        await api.updateShelf(editingShelfId, shelfForm);
      } else {
        await api.createShelf(shelfForm);
      }
      setShelfForm({ name: "", homeLocation: "", description: "", mapX: 80, mapY: 80, mapWidth: 130, mapHeight: 72, capacity: 40 });
      setEditingShelfId("");
      setMessage(editingShelfId ? "Estanteria actualizada" : "Estanteria creada");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la estanteria");
    }
  }

  async function submitGenre(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingGenreId) {
        await api.updateGenre(editingGenreId, genreForm);
      } else {
        await api.createGenre(genreForm);
      }
      setGenreForm({ name: "", color: "#461e60", icon: "ti-book" });
      setEditingGenreId("");
      setMessage(editingGenreId ? "Genero actualizado" : "Genero creado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el genero");
    }
  }

  async function submitSubgenre(event: FormEvent) {
    event.preventDefault();
    if (!subgenreForm.genreId) return;
    setError("");
    setMessage("");
    try {
      if (editingSubgenreId) {
        await api.updateSubgenre(editingSubgenreId, { name: subgenreForm.name });
      } else {
        await api.createSubgenre(subgenreForm.genreId, { name: subgenreForm.name });
      }
      setSubgenreForm({ genreId: "", name: "" });
      setEditingSubgenreId("");
      setMessage(editingSubgenreId ? "Subgenero actualizado" : "Subgenero creado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el subgenero");
    }
  }

  async function submitSection(event: FormEvent) {
    event.preventDefault();
    if (!sectionForm.shelfId) return;
    setError("");
    setMessage("");
    try {
      if (editingSectionId) {
        await api.updateSection(editingSectionId, {
          name: sectionForm.name,
          position: Number(sectionForm.position),
          genreId: sectionForm.genreId
        });
      } else {
        await api.createSection(sectionForm.shelfId, {
          name: sectionForm.name,
          position: Number(sectionForm.position),
          genreId: sectionForm.genreId
        });
      }
      setSectionForm({ shelfId: "", name: "", position: 1, genreId: "" });
      setEditingSectionId("");
      setMessage(editingSectionId ? "Repisa actualizada" : "Repisa creada");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la repisa");
    }
  }

  async function submitLoan(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createLoan(loanForm.bookId, {
        borrowerName: loanForm.borrowerName,
        borrowerContact: loanForm.borrowerContact,
        dueAt: loanForm.dueAt || undefined,
        notes: loanForm.notes
      });
      setLoanForm({ bookId: "", borrowerName: "", borrowerContact: "", dueAt: "", notes: "" });
      setMessage("Prestamo registrado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el prestamo");
    }
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Eliminar "${book.title}" del catalogo?`)) return;
    await api.deleteBook(book.id);
    setMessage("Libro eliminado");
    await loadData();
  }

  async function deleteShelf(shelf: Shelf) {
    if (!window.confirm(`Eliminar "${shelf.name}"? Los libros quedaran sin ubicacion.`)) return;
    await api.deleteShelf(shelf.id);
    setMessage("Estanteria eliminada");
    await loadData();
  }

  async function deleteSection(sectionId: string, name: string) {
    if (!window.confirm(`Eliminar la repisa "${name}"? Los libros quedaran sin repisa.`)) return;
    await api.deleteSection(sectionId);
    setMessage("Repisa eliminada");
    await loadData();
  }

  async function deleteGenre(genre: Genre) {
    if (!window.confirm(`Eliminar el genero "${genre.name}"? Se quitara de libros y estanterias.`)) return;
    await api.deleteGenre(genre.id);
    setMessage("Genero eliminado");
    await loadData();
  }

  function shelfOccupancy(shelf: Shelf) {
    const count = shelf._count?.books ?? books.filter((book) => book.shelf?.id === shelf.id).length;
    const capacity = shelf.capacity || 40;
    return { count, capacity, percent: Math.min(100, Math.round((count / capacity) * 100)) };
  }

  function pointFromSvg(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 920,
      y: ((event.clientY - rect.top) / rect.height) * 560
    };
  }

  function startShelfDrag(event: PointerEvent<SVGGElement>, shelf: Shelf) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 920,
      y: ((event.clientY - rect.top) / rect.height) * 560
    };
    setDraggingShelfId(shelf.id);
    setDragOffset({ x: point.x - shelf.mapX, y: point.y - shelf.mapY });
    setSelectedMapShelfId(shelf.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragShelf(event: PointerEvent<SVGSVGElement>) {
    if (!draggingShelfId) return;
    const point = pointFromSvg(event);
    setShelves((current) =>
      current.map((shelf) =>
        shelf.id === draggingShelfId
          ? {
              ...shelf,
              mapX: Math.max(12, Math.min(920 - shelf.mapWidth - 12, Math.round(point.x - dragOffset.x))),
              mapY: Math.max(12, Math.min(560 - shelf.mapHeight - 12, Math.round(point.y - dragOffset.y)))
            }
          : shelf
      )
    );
  }

  async function finishShelfDrag() {
    if (!draggingShelfId) return;
    const shelf = shelves.find((item) => item.id === draggingShelfId);
    setDraggingShelfId("");
    if (!shelf) return;
    try {
      await api.updateShelf(shelf.id, { mapX: shelf.mapX, mapY: shelf.mapY });
      setMessage("Mapa actualizado");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo guardar la posicion");
      await loadData();
    }
  }

  function editShelfFromMap(shelf: Shelf) {
    setEditingShelfId(shelf.id);
    setShelfForm({
      name: shelf.name,
      homeLocation: shelf.homeLocation,
      description: shelf.description ?? "",
      mapX: shelf.mapX,
      mapY: shelf.mapY,
      mapWidth: shelf.mapWidth,
      mapHeight: shelf.mapHeight,
      capacity: shelf.capacity
    });
  }

  function addShelfFromMap() {
    setEditingShelfId("");
    setShelfForm({
      name: "",
      homeLocation: "",
      description: "",
      mapX: 80 + shelves.length * 26,
      mapY: 80 + shelves.length * 18,
      mapWidth: 130,
      mapHeight: 72,
      capacity: 40
    });
  }

  function openBookOnMap(book: Book) {
    if (!book.shelf?.id) {
      setMessage("Este libro aun no tiene estanteria asignada");
      return;
    }
    setSelectedMapShelfId(book.shelf.id);
    setHighlightedShelfId(book.shelf.id);
    setActiveView("map");
    window.setTimeout(() => setHighlightedShelfId(""), 2400);
  }

  async function loadReorganizationReport() {
    setIsReorganizing(true);
    setError("");
    setMessage("");
    try {
      const report = await api.suggestReorganization();
      setReorganizationReport(report);
      setAcceptedSuggestionId("");
      setDismissedSuggestionIds([]);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "No se pudo analizar la biblioteca");
    } finally {
      setIsReorganizing(false);
    }
  }

  function acceptSuggestion(suggestion: ReorganizationSuggestion) {
    setAcceptedSuggestionId(suggestion.id);
    setMessage("Plan de movimiento generado. Confirma cada traslado cuando lo hagas fisicamente.");
  }

  function dismissSuggestion(suggestionId: string) {
    setDismissedSuggestionIds((current) => [...new Set([...current, suggestionId])]);
    if (acceptedSuggestionId === suggestionId) setAcceptedSuggestionId("");
  }

  async function confirmMove(bookId: string) {
    if (!acceptedSuggestion) return;
    const move = acceptedSuggestion.moves.find((item) => item.bookId === bookId);
    if (!move) return;
    try {
      await api.updateBook(bookId, {
        shelfId: move.toShelfId,
        shelfSectionId: move.toSectionId ?? ""
      });
      setReorganizationReport((current) =>
        current
          ? {
              ...current,
              suggestions: current.suggestions.map((suggestion) =>
                suggestion.id === acceptedSuggestion.id
                  ? {
                      ...suggestion,
                      moves: suggestion.moves.map((item) => (item.bookId === bookId ? { ...item, confirmed: true } : item))
                    }
                  : suggestion
              )
            }
          : current
      );
      setMessage("Movimiento confirmado y ubicacion actualizada");
      await loadData();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "No se pudo confirmar el movimiento");
    }
  }

  function printMovementPlan() {
    if (!acceptedSuggestion) return;
    const page = window.open("", "_blank", "width=900,height=700");
    if (!page) return;
    const rows = acceptedSuggestion.moves
      .map((move, index) => `<tr><td>${index + 1}</td><td>${move.title}</td><td>${move.fromShelfName || "Sin ubicacion"}${move.fromSectionName ? ` / ${move.fromSectionName}` : ""}</td><td>${move.toShelfName}${move.toSectionName ? ` / ${move.toSectionName}` : ""}</td></tr>`)
      .join("");
    page.document.write(`<!doctype html><html><head><title>Plan de movimiento</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{font-size:22px}</style></head><body><h1>${acceptedSuggestion.title}</h1><p>${acceptedSuggestion.summary}</p><table><thead><tr><th>#</th><th>Libro</th><th>Desde</th><th>Hacia</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()</script></body></html>`);
    page.document.close();
  }

  async function deleteSubgenre(subgenreId: string, name: string) {
    if (!window.confirm(`Eliminar el subgenero "${name}"?`)) return;
    await api.deleteSubgenre(subgenreId);
    setMessage("Subgenero eliminado");
    await loadData();
  }

  async function returnLoan(book: Book) {
    if (!book.activeLoan) return;
    await api.returnLoan(book.activeLoan.id);
    setMessage("Libro marcado como devuelto");
    await loadData();
  }

  function updateAuthor(index: number, value: string) {
    setBookForm((current) => ({
      ...current,
      authors: current.authors.map((author, authorIndex) => (authorIndex === index ? value : author))
    }));
  }

  function bookToForm(book: Book): BookPayload {
    return {
      title: book.title,
      authors: book.authors.map((author) => author.fullName),
      subtitle: book.subtitle ?? "",
      isbn10: book.isbn10 ?? "",
      isbn13: book.isbn13 ?? "",
      publisher: book.publisher?.name ?? "",
      publicationYear: book.publicationYear ?? "",
      pageCount: book.pageCount ?? "",
      genre: book.genre ?? "",
      genreId: book.genreId ?? "",
      subgenreId: book.subgenreId ?? "",
      deweyGenreRaw: book.deweyGenreRaw ?? "",
      languageCode: book.languageCode ?? "es",
      synopsis: book.synopsis ?? "",
      edition: book.edition ?? "",
      coverUrl: book.coverUrl ?? "",
      deweyCode: book.deweyCode ?? "",
      deweyHierarchy: book.deweyHierarchy ?? [],
      deweyExplanation: book.deweyExplanation ?? "",
      lcCode: book.lcCode ?? "",
      lcHierarchy: book.lcHierarchy ?? [],
      lcExplanation: book.lcExplanation ?? "",
      customTags: book.customTags ?? [],
      labelSerial: book.labelSerial ?? "",
      labelSystem: book.labelSystem ?? "DEWEY",
      labelSize: book.labelSize ?? "MEDIANO",
      availabilityStatus: book.availabilityStatus,
      readingStatus: book.readingStatus,
      isReference: book.isReference,
      shelfId: book.shelf?.id ?? "",
      shelfSectionId: book.shelfSection?.id ?? ""
    };
  }

  function startEditBook(book: Book) {
    setEditingBookId(book.id);
    setBookForm(bookToForm(book));
    setDeweyGenreSuggestion(null);
    setMessage(`Editando "${book.title}"`);
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("book");
    setOpenToolSections(["scan", "book"]);
    setBookFlowStep(2);
    setBookEntryMethod("manual");
    setOpenBookMenuId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditBook() {
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setMessage("");
    setActiveView("catalog");
    setIsToolsOpen(false);
    setDrawerMode("menu");
    setBookFlowStep(1);
    setBookEntryMethod("");
  }

  function normalizeCode(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }

  function authorKey(book: Book) {
    const author = book.authors[0]?.fullName ?? "";
    const lastName = author.trim().split(/\s+/).pop() ?? "AUT";
    return normalizeCode(lastName).slice(0, 3).padEnd(3, "X");
  }

  function titleKey(book: Book) {
    return book.publicationYear ? String(book.publicationYear) : normalizeCode(book.title).slice(0, 4);
  }

  function shelfKey(book: Book) {
    return includeShelfOnLabel && book.shelf?.name ? normalizeCode(book.shelf.name).slice(0, 8) : "";
  }

  function generateLabelSerial(book: Book, system = labelSystem) {
    const classification =
      system === "DEWEY" ? book.deweyCode : system === "LC" ? book.lcCode : book.customTags?.[0] ?? book.genre;
    return [classification || "SIN-CLAS", authorKey(book), titleKey(book), shelfKey(book)].filter(Boolean).join("\n");
  }

  function openLabelPanel(book: Book) {
    setEditingBookId(book.id);
    setBookForm(bookToForm(book));
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("labels");
    setOpenToolSections(["labels"]);
    setBookFlowStep(5);
    setOpenBookMenuId("");
    setLabelBookId(book.id);
    const system = book.labelSystem ?? (book.deweyCode ? "DEWEY" : book.lcCode ? "LC" : "PROPIA");
    setLabelSystem(system);
    setLabelSize(book.labelSize ?? "MEDIANO");
    setLabelSerialDraft(book.labelSerial || generateLabelSerial(book, system));
  }

  function toggleSelectedBook(bookId: string) {
    setSelectedBookIds((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]
    );
  }

  function labelDimensions() {
    if (labelSize === "PEQUENO") return { width: 2, height: 3 };
    if (labelSize === "MEDIANO") return { width: 3, height: 4 };
    return { width: labelWidth, height: labelHeight };
  }

  function labelHtml(book: Book, serial = book.labelSerial || generateLabelSerial(book)) {
    const { width, height } = labelDimensions();
    return `<div class="label" style="width:${width}cm;height:${height}cm"><pre>${serial}</pre></div>`;
  }

  function generateLabelSerialFromForm(system = labelSystem) {
    const classification =
      system === "DEWEY" ? bookForm.deweyCode : system === "LC" ? bookForm.lcCode : bookForm.customTags?.[0] ?? bookForm.genre;
    const author = bookForm.authors[0] ?? "";
    const lastName = author.trim().split(/\s+/).pop() ?? "AUT";
    const authorCode = normalizeCode(lastName).slice(0, 3).padEnd(3, "X");
    const titleCode = bookForm.publicationYear ? String(bookForm.publicationYear) : normalizeCode(bookForm.title).slice(0, 4);
    return [classification || "SIN-CLAS", authorCode, titleCode || "TIT"].filter(Boolean).join("\n");
  }

  async function saveLabel(book = labelBook) {
    if (!book) return;
    await api.updateBook(book.id, {
      labelSerial: labelSerialDraft,
      labelSystem,
      labelSize
    });
    setMessage("Tejuelo guardado");
    await loadData();
  }

  function printLabels(labelBooks: Book[]) {
    if (labelBooks.length === 0) {
      setError("Selecciona al menos un libro para imprimir");
      return;
    }
    const page = window.open("", "_blank", "width=900,height=700");
    if (!page) return;
    const labels = labelBooks.map((book) => labelHtml(book, book.id === labelBookId ? labelSerialDraft : undefined)).join("");
    page.document.write(`<!doctype html><html><head><title>Tejuelos</title><style>
      @page { size: ${labelPageSize}; margin: 1cm; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .sheet { display: grid; grid-template-columns: repeat(${labelColumns}, max-content); gap: 0.25cm; align-content: start; }
      .label { border: 1px solid #222; display: grid; place-items: center; page-break-inside: avoid; }
      pre { margin: 0; text-align: center; font-weight: 700; font-size: 10pt; line-height: 1.25; white-space: pre-wrap; }
    </style></head><body><main class="sheet">${labels}</main><script>window.print()</script></body></html>`);
    page.document.close();
  }

  function downloadLabelPng(book = labelBook) {
    if (!book) return;
    const { width, height } = labelDimensions();
    const scale = 96 / 2.54;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#222222";
    context.strokeRect(0, 0, canvas.width - 1, canvas.height - 1);
    context.fillStyle = "#111111";
    context.font = "bold 16px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = (labelSerialDraft || generateLabelSerial(book)).split("\n");
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, canvas.height / 2 + (index - (lines.length - 1) / 2) * 22);
    });
    const link = document.createElement("a");
    link.download = `tejuelo-${book.title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function setToolSection(section: string, isOpen: boolean) {
    setOpenToolSections((current) =>
      isOpen ? [...new Set([...current, section])] : current.filter((item) => item !== section)
    );
  }

  if (activeView === "book-flow") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>{editingBookId ? "Editar libro" : "Crear nuevo libro"}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="ghost" onClick={cancelBookFlow}>
              <X size={17} /> Cancelar
            </button>
          </div>
        </header>

        <main className="flow-layout">
          <section className="flow-panel">
            <div className="form-intro">
              <h2>{editingBookId ? "Datos del libro" : "Nuevo libro"}</h2>
              <p>Completa o importa los datos, revisa la clasificacion, elige ubicacion y guarda cuando este listo.</p>
            </div>

            {message && <div className="notice success">{message}</div>}
            {error && <div className="notice error">{error}</div>}
            {duplicateMatches.length > 0 && (
              <div className="duplicate-alert">
                <div>
                  <h2>Posible duplicado detectado</h2>
                  <p>Ya existe un libro parecido. Puedes actualizarlo, agregar este de todas formas o cancelar.</p>
                </div>
                <div className="duplicate-list">
                  {duplicateMatches.map((match) => (
                    <article className="duplicate-card" key={match.book.id}>
                      <div className="cover mini">
                        {match.book.coverUrl ? <img src={match.book.coverUrl} alt={`Portada de ${match.book.title}`} /> : <BookOpen size={28} />}
                      </div>
                      <div>
                        <strong>{match.book.title}</strong>
                        <p>{authorsLine(match.book) || "Autor sin registrar"}</p>
                        <span>{match.reason} · {Math.round(match.score * 100)}%</span>
                        <div className="duplicate-actions">
                          <button type="button" className="primary" onClick={() => updateDuplicateExisting(match)}>Actualizar existente</button>
                          <button type="button" className="ghost" onClick={addDuplicateAnyway}>Agregar de todas formas</button>
                          <button type="button" className="danger-soft" onClick={cancelDuplicateSave}>Cancelar</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {!editingBookId && (
              <section className="flow-card">
                <h2>Metodo de ingreso</h2>
                <div className="method-grid">
                  <button className={bookEntryMethod === "scan" ? "active" : ""} onClick={() => chooseBookEntryMethod("scan")}><Barcode size={18} /> Escanear codigo de barras</button>
                  <button className={bookEntryMethod === "isbn" ? "active" : ""} onClick={() => chooseBookEntryMethod("isbn")}><Search size={18} /> Buscar por ISBN</button>
                  <button className={bookEntryMethod === "search" ? "active" : ""} onClick={() => chooseBookEntryMethod("search")}><BookOpen size={18} /> Buscar sin ISBN</button>
                  <button className={bookEntryMethod === "manual" ? "active" : ""} onClick={() => chooseBookEntryMethod("manual")}><Pencil size={18} /> Agregar manualmente</button>
                </div>

                {bookEntryMethod === "scan" && (
                  <div className="stack-form flow-tool">
                    <div className="scanner-frame">
                      <video ref={videoRef} muted playsInline />
                      {!isScanning && <div className="scanner-placeholder"><Camera size={28} /><span>Camara lista</span></div>}
                    </div>
                    {scanStatus && <p className="helper-text">{scanStatus}</p>}
                    <div className="two-cols">
                      <button type="button" className="primary" onClick={startScanner} disabled={isScanning || isLookupLoading}><Camera size={17} /> Escanear</button>
                      <button type="button" className="ghost" onClick={stopScanner} disabled={!isScanning}><Square size={15} /> Detener</button>
                    </div>
                  </div>
                )}

                {bookEntryMethod === "isbn" && (
                  <div className="isbn-lookup-row flow-tool">
                    <input placeholder="ISBN manual" value={isbnLookup} onChange={(event) => setIsbnLookup(event.target.value)} />
                    <button type="button" className="primary" onClick={() => lookupIsbn(isbnLookup)} disabled={isLookupLoading}><Search size={16} /> Buscar</button>
                  </div>
                )}

                {bookEntryMethod === "search" && (
                  <div className="book-search-panel flow-tool">
                    <div className="two-cols">
                      <input placeholder="Titulo sin ISBN" value={bookSearchForm.title} onChange={(event) => setBookSearchForm({ ...bookSearchForm, title: event.target.value })} />
                      <input placeholder="Autor opcional" value={bookSearchForm.author} onChange={(event) => setBookSearchForm({ ...bookSearchForm, author: event.target.value })} />
                    </div>
                    <div className="two-cols">
                      <input placeholder="Editorial opcional" value={bookSearchForm.publisher} onChange={(event) => setBookSearchForm({ ...bookSearchForm, publisher: event.target.value })} />
                      <input placeholder="Año opcional" type="number" value={bookSearchForm.year} onChange={(event) => setBookSearchForm({ ...bookSearchForm, year: event.target.value })} />
                    </div>
                    <button type="button" className="primary" onClick={searchBooksWithoutIsbn} disabled={isBookSearching}><BookOpen size={16} /> Buscar sin ISBN</button>
                    {bookSearchResults.length > 0 && (
                      <div className="external-results">
                        {bookSearchResults.map((book, index) => (
                          <button type="button" key={`${book.source}-${book.title}-${index}`} onClick={() => useExternalBookResult(book)}>
                            {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={22} />}
                            <span>
                              <strong>{book.title}</strong>
                              <small>{[book.authors?.join(", "), book.publicationYear, book.publisher].filter(Boolean).join(" · ") || "Datos publicos"}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Edicion de datos</h2>
                <div className="stack-form">
                  <input required placeholder="Titulo" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                  {bookForm.authors.map((author, index) => (
                    <input required={index === 0} key={index} placeholder={index === 0 ? "Autor principal" : "Otro autor"} value={author} onChange={(e) => updateAuthor(index, e.target.value)} />
                  ))}
                  <button type="button" className="ghost" onClick={() => setBookForm({ ...bookForm, authors: [...bookForm.authors, ""] })}><Plus size={16} /> Otro autor</button>
                  <div className="two-cols">
                    <input placeholder="ISBN 13" value={bookForm.isbn13} onChange={(e) => setBookForm({ ...bookForm, isbn13: e.target.value })} />
                    <input placeholder="Año" type="number" value={bookForm.publicationYear} onChange={(e) => setBookForm({ ...bookForm, publicationYear: e.target.value ? Number(e.target.value) : "" })} />
                  </div>
                  <input placeholder="Editorial" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} />
                  <div className="two-cols">
                    <input placeholder="Genero libre" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })} />
                    <input placeholder="Paginas" type="number" value={bookForm.pageCount} onChange={(e) => setBookForm({ ...bookForm, pageCount: e.target.value ? Number(e.target.value) : "" })} />
                  </div>
                  <div className="two-cols">
                    <select value={bookForm.genreId} onChange={(e) => setBookForm({ ...bookForm, genreId: e.target.value, subgenreId: "" })}>
                      <option value="">Genero principal</option>
                      {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                    </select>
                    <select value={bookForm.subgenreId} onChange={(e) => setBookForm({ ...bookForm, subgenreId: e.target.value })} disabled={!bookForm.genreId}>
                      <option value="">Subgenero</option>
                      {selectedBookSubgenres.map((subgenre) => <option key={subgenre.id} value={subgenre.id}>{subgenre.name}</option>)}
                    </select>
                  </div>
                  {deweyGenreSuggestion && (
                    <div className={`ai-genre-suggestion ${deweyGenreSuggestion.confianza}`}>
                      <div><span className="suggestion-badge">{deweyGenreSuggestion.confianza === "alta" ? "Alta" : deweyGenreSuggestion.confianza === "media" ? "Sugerido" : "Confirmar"}</span><strong>{deweyGenreSuggestion.genero_principal}{deweyGenreSuggestion.subgenero ? ` / ${deweyGenreSuggestion.subgenero}` : ""}</strong></div>
                      <p>{deweyGenreSuggestion.razon}</p>
                      <button type="button" className="ghost" onClick={applyDeweyGenreSuggestion}><Check size={15} /> Usar sugerencia</button>
                    </div>
                  )}
                  <input placeholder="Genero Dewey/API sin procesar" value={bookForm.deweyGenreRaw} onChange={(e) => setBookForm({ ...bookForm, deweyGenreRaw: e.target.value })} />
                  <input placeholder="URL de portada" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })} />
                  <textarea placeholder="Sinopsis" value={bookForm.synopsis} onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })} />
                  <button className="ghost" type="button" onClick={suggestClassification}><Sparkles size={17} /> Sugerir clasificacion</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Clasificacion por IA</h2>
                <div className="stack-form">
                  <button type="button" className="primary" onClick={suggestClassification} disabled={isClassifying}><Sparkles size={17} /> {isClassifying ? "Consultando..." : "Sugerir con IA"}</button>
                  <div className="two-cols">
                    <input placeholder="Codigo Dewey" value={classificationDraft.deweyCode ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyCode: event.target.value })} />
                    <input placeholder="Signatura LC" value={classificationDraft.lcCode ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcCode: event.target.value })} />
                  </div>
                  <textarea placeholder="Jerarquia Dewey, una linea por nivel" value={classificationDraft.deweyHierarchy.join("\n")} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyHierarchy: splitLines(event.target.value) })} />
                  <textarea placeholder="Explicacion Dewey" value={classificationDraft.deweyExplanation ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyExplanation: event.target.value })} />
                  <textarea placeholder="Jerarquia LC, una linea por nivel" value={classificationDraft.lcHierarchy.join("\n")} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcHierarchy: splitLines(event.target.value) })} />
                  <textarea placeholder="Explicacion LC" value={classificationDraft.lcExplanation ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcExplanation: event.target.value })} />
                  <label className="tag-input"><Tags size={16} /><input placeholder="Etiquetas separadas por coma" value={classificationDraft.customTags.join(", ")} onChange={(event) => setClassificationDraft({ ...classificationDraft, customTags: splitTags(event.target.value) })} /></label>
                  <button type="button" className="primary" onClick={() => applyClassificationToForm(classificationDraft)}><Check size={17} /> Aplicar clasificacion</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Ubicacion en estanteria</h2>
                <div className="stack-form">
                  <select value={bookForm.shelfId} onChange={(e) => setBookForm({ ...bookForm, shelfId: e.target.value, shelfSectionId: "" })}>
                    <option value="">Sin estanteria</option>
                    {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
                  </select>
                  <select value={bookForm.shelfSectionId} onChange={(e) => setBookForm({ ...bookForm, shelfSectionId: e.target.value })}>
                    <option value="">Sin repisa</option>
                    {selectedShelf?.sections.map((section) => <option key={section.id} value={section.id}>{section.name}{section.genreRef ? ` · ${section.genreRef.name}` : ""}</option>)}
                  </select>
                  {selectedSectionGenreMismatch && <div className="notice warning">Esta repisa es de {selectedShelfSection?.genreRef?.name}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual.</div>}
                  <button type="button" className="ghost" onClick={() => setLabelSerialDraft(bookForm.labelSerial || generateLabelSerialFromForm())}><Printer size={17} /> Actualizar tejuelo</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Generacion del tejuelo</h2>
                <div className="stack-form">
                  <div className="two-cols">
                    <select value={labelSystem} onChange={(event) => { const system = event.target.value as "DEWEY" | "LC" | "PROPIA"; setLabelSystem(system); setLabelSerialDraft(generateLabelSerialFromForm(system)); }}>
                      <option value="DEWEY">Dewey</option>
                      <option value="LC">LC</option>
                      <option value="PROPIA">Propia</option>
                    </select>
                    <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as any)}>
                      <option value="PEQUENO">Pequeno 2 x 3 cm</option>
                      <option value="MEDIANO">Mediano 3 x 4 cm</option>
                      <option value="PERSONALIZADO">Personalizado</option>
                    </select>
                  </div>
                  <textarea placeholder="Seriado del tejuelo" value={labelSerialDraft} onChange={(event) => setLabelSerialDraft(event.target.value)} />
                  <div className="label-preview">{labelSerialDraft || generateLabelSerialFromForm()}</div>
                  <button type="button" className="primary" onClick={() => saveBookPayload({ ...normalizedBookPayload(), labelSerial: labelSerialDraft || generateLabelSerialFromForm(), labelSystem, labelSize })}><Check size={17} /> Guardar libro</button>
                </div>
              </section>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (activeView === "map") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Mapa de la casa</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="ghost" onClick={addShelfFromMap}><Plus size={17} /> Estanteria</button>
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="map-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="floorplan-panel">
            <div className="floorplan-toolbar">
              <div>
                <p className="eyebrow dark">Plano editable</p>
                <h2>Distribucion de estanterias</h2>
              </div>
              <button className="primary" onClick={addShelfFromMap}><Plus size={17} /> Nueva</button>
            </div>
            <svg
              className="floorplan-svg"
              viewBox="0 0 920 560"
              role="img"
              aria-label="Plano simplificado de la casa"
              onPointerMove={dragShelf}
              onPointerUp={finishShelfDrag}
              onPointerCancel={finishShelfDrag}
            >
              <rect x="18" y="18" width="884" height="524" rx="12" className="room-outline" />
              <line x1="330" y1="18" x2="330" y2="542" className="room-line" />
              <line x1="610" y1="18" x2="610" y2="542" className="room-line" />
              <line x1="18" y1="295" x2="902" y2="295" className="room-line" />
              <text x="48" y="58" className="room-label">Sala</text>
              <text x="360" y="58" className="room-label">Estudio</text>
              <text x="640" y="58" className="room-label">Habitacion</text>
              <text x="48" y="335" className="room-label">Pasillo</text>
              {shelves.map((shelf) => {
                const occupancy = shelfOccupancy(shelf);
                const isSelected = selectedMapShelfId === shelf.id;
                const isHighlighted = highlightedShelfId === shelf.id;
                return (
                  <g
                    key={shelf.id}
                    className={`shelf-block ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                    transform={`translate(${shelf.mapX} ${shelf.mapY})`}
                    onPointerDown={(event) => startShelfDrag(event, shelf)}
                    onClick={() => setSelectedMapShelfId(shelf.id)}
                  >
                    <rect width={shelf.mapWidth} height={shelf.mapHeight} rx="8" />
                    <rect className="occupancy-fill" x="8" y={shelf.mapHeight - 15} width={(shelf.mapWidth - 16) * occupancy.percent / 100} height="7" rx="4" />
                    <text x="12" y="25">{shelf.name}</text>
                    <text x="12" y="45" className="shelf-small">{occupancy.count}/{occupancy.capacity} libros</text>
                  </g>
                );
              })}
            </svg>
            <div className="mobile-shelf-map">
              {shelves.map((shelf) => {
                const occupancy = shelfOccupancy(shelf);
                return (
                  <button key={shelf.id} className={selectedMapShelfId === shelf.id ? "active" : ""} onClick={() => setSelectedMapShelfId(shelf.id)}>
                    <span><strong>{shelf.name}</strong><small>{shelf.homeLocation}</small></span>
                    <span className="capacity-bar"><i style={{ width: `${occupancy.percent}%` }} /></span>
                    <small>{occupancy.count}/{occupancy.capacity}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="map-side">
            <section className="panel-section">
              <h2>{editingShelfId ? "Editar estanteria" : "Agregar estanteria"}</h2>
              <form onSubmit={submitShelf} className="stack-form compact">
                <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
                <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
                <div className="two-cols">
                  <input type="number" min="1" placeholder="Capacidad" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
                  <input type="number" min="70" placeholder="Ancho" value={shelfForm.mapWidth} onChange={(e) => setShelfForm({ ...shelfForm, mapWidth: Number(e.target.value) })} />
                </div>
                <div className="two-cols">
                  <input type="number" min="44" placeholder="Alto" value={shelfForm.mapHeight} onChange={(e) => setShelfForm({ ...shelfForm, mapHeight: Number(e.target.value) })} />
                  <input type="number" min="0" placeholder="X" value={shelfForm.mapX} onChange={(e) => setShelfForm({ ...shelfForm, mapX: Number(e.target.value) })} />
                </div>
                <textarea placeholder="Descripcion" value={shelfForm.description} onChange={(e) => setShelfForm({ ...shelfForm, description: e.target.value })} />
                <button className="primary" type="submit">{editingShelfId ? "Guardar cambios" : "Crear estanteria"}</button>
                {editingShelfId && <button type="button" className="danger-soft" onClick={() => selectedMapShelf && deleteShelf(selectedMapShelf)}><Trash2 size={16} /> Eliminar</button>}
              </form>
            </section>
            <section className="panel-section">
              <h2>{selectedMapShelf ? selectedMapShelf.name : "Selecciona una estanteria"}</h2>
              {selectedMapShelf ? (
                <div className="shelf-book-panel">
                  <div className="map-side-actions">
                    <button type="button" className="ghost" onClick={() => editShelfFromMap(selectedMapShelf)}><Pencil size={16} /> Renombrar</button>
                    <button type="button" className="ghost" onClick={() => printLabels(selectedMapShelfBooks)}><Printer size={16} /> Planilla</button>
                  </div>
                  {selectedMapShelf.sections.map((section) => (
                    <div key={section.id} className="section-books">
                      <strong>{section.name}</strong>
                      {(booksBySection.get(section.id) ?? []).map((book) => (
                        <button key={book.id} onClick={() => startEditBook(book)}>
                          <span>{book.title}</span>
                          <small>{book.labelSerial?.split("\n")[0] || book.deweyCode || "Sin tejuelo"}</small>
                        </button>
                      ))}
                    </div>
                  ))}
                  {(booksBySection.get("sin-repisa") ?? []).length > 0 && (
                    <div className="section-books">
                      <strong>Sin repisa</strong>
                      {(booksBySection.get("sin-repisa") ?? []).map((book) => (
                        <button key={book.id} onClick={() => startEditBook(book)}>
                          <span>{book.title}</span>
                          <small>{book.labelSerial?.split("\n")[0] || book.deweyCode || "Sin tejuelo"}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="helper-text">Haz clic en un bloque del plano o en una estanteria de la lista movil.</p>
              )}
            </section>
          </aside>
        </main>
      </div>
    );
  }

  if (activeView === "assistant") {
    const visibleSuggestions = reorganizationReport?.suggestions.filter((suggestion) => !dismissedSuggestionIds.includes(suggestion.id)) ?? [];
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Asistente de reorganizacion</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="primary" onClick={loadReorganizationReport} disabled={isReorganizing}><Sparkles size={17} /> Analizar</button>
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="assistant-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="assistant-summary">
            <div>
              <p className="eyebrow dark">{reorganizationReport?.source === "claude" ? "Claude" : "Analisis local"}</p>
              <h2>{reorganizationReport ? reorganizationReport.overview : "Analiza la distribucion actual de tu biblioteca"}</h2>
            </div>
            <button className="primary" onClick={loadReorganizationReport} disabled={isReorganizing}><Sparkles size={17} /> {isReorganizing ? "Analizando..." : "Generar informe"}</button>
          </section>
          <section className="assistant-grid">
            <div className="suggestion-list">
              {visibleSuggestions.map((suggestion) => (
                <article className={`suggestion-card ${acceptedSuggestionId === suggestion.id ? "accepted" : ""}`} key={suggestion.id}>
                  <div>
                    <span className={`confidence ${suggestion.confidence}`}>{suggestion.confidence}</span>
                    <h2>{suggestion.title}</h2>
                    <p>{suggestion.summary}</p>
                    <small>{suggestion.reason}</small>
                  </div>
                  <div className="suggestion-actions">
                    <button className="primary" onClick={() => acceptSuggestion(suggestion)}><Check size={16} /> Aceptar</button>
                    <button className="ghost" onClick={() => dismissSuggestion(suggestion.id)}><X size={16} /> Descartar</button>
                  </div>
                </article>
              ))}
              {reorganizationReport && visibleSuggestions.length === 0 && <div className="empty-state"><Sparkles size={32} /><p>No quedan sugerencias pendientes.</p></div>}
            </div>
            <aside className="movement-plan panel-section">
              <h2>{acceptedSuggestion ? acceptedSuggestion.title : "Plan de movimiento"}</h2>
              {acceptedSuggestion ? (
                <>
                  <p className="helper-text">{acceptedSuggestion.moves.length} movimientos propuestos.</p>
                  <button className="ghost" onClick={printMovementPlan}><Printer size={16} /> Imprimir o guardar</button>
                  <div className="move-list">
                    {acceptedSuggestion.moves.map((move, index) => (
                      <div key={move.bookId} className={move.confirmed ? "move-row done" : "move-row"}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{move.title}</strong>
                          <small>{move.fromShelfName || "Sin ubicacion"}{move.fromSectionName ? ` / ${move.fromSectionName}` : ""} {"->"} {move.toShelfName}{move.toSectionName ? ` / ${move.toSectionName}` : ""}</small>
                        </div>
                        <button className="ghost" onClick={() => confirmMove(move.bookId)} disabled={move.confirmed}>{move.confirmed ? "Listo" : "Confirmar"}</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="helper-text">Acepta una sugerencia para ver la lista ordenada de libros que debes mover.</p>
              )}
            </aside>
          </section>
        </main>
      </div>
    );
  }

  if (activeView === "management") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Gestion de estanterias</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="management-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="management-intro">
            <div>
              <p className="eyebrow dark">Organizacion</p>
              <h2>Gestion de estanterias y catalogos</h2>
            </div>
            <p>Administra la estructura fisica de tu biblioteca y las categorias que ayudan a ubicar cada libro.</p>
          </section>
          <section className="management-grid">
            <details open className="management-section">
              <summary><Library size={18} /> Estanterias</summary>
              <form onSubmit={submitShelf} className="stack-form compact">
                <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
                <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
                <input type="number" min="1" placeholder="Capacidad de libros" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
                <button className="primary" type="submit">{editingShelfId ? "Actualizar estanteria" : "Crear estanteria"}</button>
                {editingShelfId && <button type="button" className="ghost" onClick={() => { setEditingShelfId(""); setShelfForm({ name: "", homeLocation: "", description: "", mapX: 80, mapY: 80, mapWidth: 130, mapHeight: 72, capacity: 40 }); }}>Cancelar</button>}
              </form>
              <div className="shelf-list">
                {shelves.map((shelf) => (
                  <div key={shelf.id} className="shelf-row">
                    <div className="shelf-row-header">
                      <div><strong>{shelf.name}</strong><span>{shelf.homeLocation} · {shelf._count?.books ?? 0} libros</span></div>
                      <div className="genre-actions">
                        <button type="button" onClick={() => editShelfFromMap(shelf)}><Pencil size={14} /></button>
                        <button type="button" className="danger-soft" onClick={() => deleteShelf(shelf)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Library size={18} /> Repisas</summary>
              <form onSubmit={submitSection} className="stack-form compact">
                <select required value={sectionForm.shelfId} onChange={(e) => setSectionForm({ ...sectionForm, shelfId: e.target.value })}>
                  <option value="">Elegir estanteria</option>
                  {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
                </select>
                <div className="two-cols">
                  <input required placeholder="Repisa" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
                  <input required type="number" min="1" value={sectionForm.position} onChange={(e) => setSectionForm({ ...sectionForm, position: Number(e.target.value) })} />
                </div>
                <select value={sectionForm.genreId} onChange={(e) => setSectionForm({ ...sectionForm, genreId: e.target.value })}>
                  <option value="">Sin genero dedicado</option>
                  {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
                <button className="primary" type="submit">{editingSectionId ? "Actualizar repisa" : "Crear repisa"}</button>
                {editingSectionId && <button type="button" className="ghost" onClick={() => { setEditingSectionId(""); setSectionForm({ shelfId: "", name: "", position: 1, genreId: "" }); }}>Cancelar</button>}
              </form>
              <div className="shelf-list">
                {shelves.map((shelf) => shelf.sections.map((section) => (
                  <div key={section.id} className="section-row">
                    <span>{shelf.name} · {section.name}{section.genreRef ? ` · ${section.genreRef.name}` : ""}</span>
                    <div>
                      <button type="button" onClick={() => { setEditingSectionId(section.id); setSectionForm({ shelfId: shelf.id, name: section.name, position: section.position, genreId: section.genreId ?? "" }); }}><Pencil size={14} /></button>
                      <button type="button" className="danger-soft" onClick={() => deleteSection(section.id, section.name)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Tags size={18} /> Generos</summary>
              <form onSubmit={submitGenre} className="stack-form compact">
                <div className="two-cols">
                  <input required placeholder="Genero" value={genreForm.name} onChange={(e) => setGenreForm({ ...genreForm, name: e.target.value })} />
                  <input type="color" value={genreForm.color} onChange={(e) => setGenreForm({ ...genreForm, color: e.target.value })} />
                </div>
                <input placeholder="Icono Tabler (ej. ti-book)" value={genreForm.icon} onChange={(e) => setGenreForm({ ...genreForm, icon: e.target.value })} />
                <button className="primary" type="submit">{editingGenreId ? "Actualizar genero" : "Crear genero"}</button>
                {editingGenreId && <button type="button" className="ghost" onClick={() => { setEditingGenreId(""); setGenreForm({ name: "", color: "#461e60", icon: "ti-book" }); }}>Cancelar</button>}
              </form>
              <div className="genre-list">
                {genres.map((genre) => (
                  <div key={genre.id} className="genre-row">
                    <div className="genre-title"><span className="genre-color" style={{ background: genre.color }} /><strong>{genre.name}</strong><small>{genre.icon}</small></div>
                    <div className="genre-actions">
                      <button type="button" onClick={() => { setEditingGenreId(genre.id); setGenreForm({ name: genre.name, color: genre.color, icon: genre.icon }); }}><Pencil size={14} /></button>
                      <button type="button" className="danger-soft" onClick={() => deleteGenre(genre)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Tags size={18} /> Subgeneros</summary>
              <form onSubmit={submitSubgenre} className="stack-form compact">
                <select required value={subgenreForm.genreId} onChange={(e) => setSubgenreForm({ ...subgenreForm, genreId: e.target.value })}>
                  <option value="">Genero para subgenero</option>
                  {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
                <input required placeholder="Subgenero" value={subgenreForm.name} onChange={(e) => setSubgenreForm({ ...subgenreForm, name: e.target.value })} />
                <button className="primary" type="submit">{editingSubgenreId ? "Actualizar subgenero" : "Crear subgenero"}</button>
              </form>
              <div className="genre-list">
                {genres.map((genre) => genre.subgenres.map((subgenre) => (
                  <span key={subgenre.id} className="subgenre-pill">
                    {genre.name} · {subgenre.name}
                    <button type="button" onClick={() => { setEditingSubgenreId(subgenre.id); setSubgenreForm({ genreId: genre.id, name: subgenre.name }); }}><Pencil size={12} /></button>
                    <button type="button" onClick={() => deleteSubgenre(subgenre.id, subgenre.name)}><X size={12} /></button>
                  </span>
                )))}
              </div>
            </details>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src={guardaLogo} alt="GUARDA" />
          <div>
            <p className="eyebrow">Biblioteca personal</p>
            <h1>Catalogo de casa</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="tools-button" onClick={() => { setDrawerMode("menu"); setIsToolsOpen(true); }}>
            <Menu size={18} /> Herramientas
          </button>
          <button className="icon-button" onClick={() => setActiveView("map")} title="Mapa">
            <MapIcon size={18} />
          </button>
          <button className="icon-button" onClick={loadData} title="Actualizar">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="catalog-panel">
          <div className="toolbar">
            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por titulo, autor, ISBN, editorial, genero o año"
              />
            </label>
            <select
              value={genreFilter}
              onChange={(event) => {
                setGenreFilter(event.target.value);
                setSubgenreFilter("");
              }}
            >
              <option value="">Todos los generos</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
            <select value={subgenreFilter} onChange={(event) => setSubgenreFilter(event.target.value)}>
              <option value="">Todos los subgeneros</option>
              {filterSubgenres.map((subgenre) => (
                <option key={subgenre.id} value={subgenre.id}>
                  {subgenre.name}
                </option>
              ))}
            </select>
            <select
              value={shelfFilter}
              onChange={(event) => {
                setShelfFilter(event.target.value);
                if (event.target.value) setSortOrder("shelfOrder");
              }}
            >
              <option value="">Todas las estanterias</option>
              {shelves.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="updated">Recientes</option>
              <option value="title">Titulo</option>
              <option value="author">Autor</option>
              <option value="shelfOrder">Orden de estanteria</option>
            </select>
            <div className="segmented" aria-label="Cambiar vista">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} title="Cuadricula">
                <Grid2X2 size={17} />
              </button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title="Lista">
                <List size={17} />
              </button>
            </div>
          </div>

          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          {duplicateMatches.length > 0 && (
            <div className="duplicate-alert">
              <div>
                <h2>Posible duplicado detectado</h2>
                <p>Ya existe un libro parecido en tu biblioteca. Puedes cancelar, agregarlo como otra edicion o actualizar el existente.</p>
              </div>
              <div className="duplicate-list">
                {duplicateMatches.map((match) => (
                  <article className="duplicate-card" key={match.book.id}>
                    <div className="cover mini">
                      {match.book.coverUrl ? (
                        <img src={match.book.coverUrl} alt={`Portada de ${match.book.title}`} />
                      ) : (
                        <BookOpen size={28} />
                      )}
                    </div>
                    <div>
                      <strong>{match.book.title}</strong>
                      <p>{authorsLine(match.book) || "Autor sin registrar"}</p>
                      <span>
                        {match.reason} · {Math.round(match.score * 100)}%
                      </span>
                      <div className="duplicate-actions">
                        <button type="button" className="primary" onClick={() => updateDuplicateExisting(match)}>
                          Actualizar existente
                        </button>
                        <button type="button" className="ghost" onClick={addDuplicateAnyway}>
                          Agregar de todas formas
                        </button>
                        <button type="button" className="danger-soft" onClick={cancelDuplicateSave}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="catalog-heading">
            <h2>{total} libros</h2>
            {isLoading && <span>Cargando...</span>}
          </div>

          <div className={view === "grid" ? "book-grid" : "book-list"}>
            {books.map((book) => (
              <article className="book-card" key={book.id}>
                <div className="cover">
                  <label className="select-book">
                    <input
                      type="checkbox"
                      checked={selectedBookIds.includes(book.id)}
                      onChange={() => toggleSelectedBook(book.id)}
                    />
                  </label>
                  {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={42} />}
                </div>
                <div className="book-content">
                  <div>
                    <h3>{book.title}</h3>
                    <p>{authorsLine(book) || "Autor sin registrar"}</p>
                  </div>
                  <div className="meta-line">
                    {book.publisher?.name && <span>{book.publisher.name}</span>}
                    {book.publicationYear && <span>{book.publicationYear}</span>}
                    {book.genre && <span>{book.genre}</span>}
                  </div>
                  <div className="chips">
                    <span>{formatAvailability(book.availabilityStatus)}</span>
                    <span>{formatReading(book.readingStatus)}</span>
                    {book.genreRef && (
                      <span style={{ borderColor: book.genreRef.color, color: book.genreRef.color }}>
                        {book.genreRef.name}
                      </span>
                    )}
                    {book.deweyCode && <span>DDC {book.deweyCode}</span>}
                    {book.lcCode && <span>LC {book.lcCode}</span>}
                    {book.labelSerial && <span>Tejuelo {book.labelSerial.split("\n")[0]}</span>}
                    {book.isReference && <span>Referencia</span>}
                  </div>
                  {book.customTags?.length > 0 && <p className="tag-line">{book.customTags.join(", ")}</p>}
                  <p className="location">
                    <Library size={15} />
                    {book.shelf?.name ?? "Sin ubicacion"}
                    {book.shelfSection ? ` · ${book.shelfSection.name}` : ""}
                  </p>
                  {book.activeLoan && <p className="loan">Prestado a {book.activeLoan.borrowerName}</p>}
                  <div className="card-actions">
                    {book.activeLoan ? (
                      <button onClick={() => returnLoan(book)}>
                        <Undo2 size={16} /> Devolver
                      </button>
                    ) : (
                      <button onClick={() => { setLoanForm((current) => ({ ...current, bookId: book.id })); setIsToolsOpen(true); }}>
                        <Send size={16} /> Prestar
                      </button>
                    )}
                    <button onClick={() => startEditBook(book)} title="Editar">
                      <Pencil size={16} /> Editar
                    </button>
                    <button onClick={() => openBookOnMap(book)} title="Ver en mapa">
                      <MapIcon size={16} /> Mapa
                    </button>
                    <button className="danger-soft" onClick={() => deleteBook(book)} title="Eliminar">
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!isLoading && books.length === 0 && (
            <div className="empty-state">
              <BookOpen size={36} />
              <p>No hay libros con esos criterios.</p>
            </div>
          )}
        </section>

        {isToolsOpen && <button className="drawer-overlay" aria-label="Cerrar herramientas" onClick={() => { setIsToolsOpen(false); setDrawerMode("menu"); }} />}
        <aside className={`side-panel ${isToolsOpen ? "open" : ""} drawer-mode-${drawerMode}`}>
          <div className="drawer-header">
            <div>
              <p className="eyebrow dark">Herramientas</p>
              <h2>Gestion de biblioteca</h2>
            </div>
            <button
              className="icon-menu"
              onClick={() => {
                setIsToolsOpen(false);
                setDrawerMode("menu");
                if (drawerMode === "book") cancelEditBook();
              }}
              title="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
          {drawerMode === "menu" && (
            <div className="global-menu-actions">
              <button type="button" className="primary" onClick={startNewBookFlow}>
                <Plus size={18} /> Crear nuevo libro
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("management"); setIsToolsOpen(false); }}>
                <Library size={18} /> Gestion de estanterias
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("map"); setIsToolsOpen(false); }}>
                <MapIcon size={18} /> Mapa de la casa
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("assistant"); setIsToolsOpen(false); void loadReorganizationReport(); }}>
                <Sparkles size={18} /> Asistente de reorganizacion
              </button>
            </div>
          )}
          <details
            className="panel-section scanner-panel drawer-section"
            open={openToolSections.includes("scan")}
            onToggle={(event) => setToolSection("scan", event.currentTarget.open)}
          >
            <summary>
              <Barcode size={18} /> Escanear ISBN
            </summary>
            <div className="stack-form">
              <div className="scanner-frame">
                <video ref={videoRef} muted playsInline />
                {!isScanning && (
                  <div className="scanner-placeholder">
                    <Camera size={28} />
                    <span>Camara lista</span>
                  </div>
                )}
              </div>
              {scanStatus && <p className="helper-text">{scanStatus}</p>}
              <div className="two-cols">
                <button type="button" className="primary" onClick={startScanner} disabled={isScanning || isLookupLoading}>
                  <Camera size={17} /> Escanear
                </button>
                <button type="button" className="ghost" onClick={stopScanner} disabled={!isScanning}>
                  <Square size={15} /> Detener
                </button>
              </div>
              <div className="isbn-lookup-row">
                <input
                  placeholder="ISBN manual"
                  value={isbnLookup}
                  onChange={(event) => setIsbnLookup(event.target.value)}
                />
                <button type="button" className="ghost" onClick={() => lookupIsbn(isbnLookup)} disabled={isLookupLoading}>
                  <Search size={16} /> Buscar
                </button>
              </div>
              <div className="book-search-panel">
                <div className="two-cols">
                  <input
                    placeholder="Titulo sin ISBN"
                    value={bookSearchForm.title}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, title: event.target.value })}
                  />
                  <input
                    placeholder="Autor opcional"
                    value={bookSearchForm.author}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, author: event.target.value })}
                  />
                </div>
                <div className="two-cols">
                  <input
                    placeholder="Editorial opcional"
                    value={bookSearchForm.publisher}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, publisher: event.target.value })}
                  />
                  <input
                    placeholder="Año opcional"
                    type="number"
                    value={bookSearchForm.year}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, year: event.target.value })}
                  />
                </div>
                <button type="button" className="ghost" onClick={searchBooksWithoutIsbn} disabled={isBookSearching}>
                  <BookOpen size={16} /> Buscar sin ISBN
                </button>
                {bookSearchResults.length > 0 && (
                  <div className="external-results">
                    {bookSearchResults.map((book, index) => (
                      <button type="button" key={`${book.source}-${book.title}-${index}`} onClick={() => useExternalBookResult(book)}>
                        {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={22} />}
                        <span>
                          <strong>{book.title}</strong>
                          <small>
                            {[book.authors?.join(", "), book.publicationYear, book.publisher].filter(Boolean).join(" · ") || "Datos publicos"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>

          <details
            className="panel-section book-entry-panel drawer-section"
            open={openToolSections.includes("book")}
            onToggle={(event) => setToolSection("book", event.currentTarget.open)}
          >
            <summary>
              <Plus size={18} /> {editingBookId ? "Editar libro" : "Agregar libro"}
            </summary>
            <form onSubmit={submitBook} className="stack-form">
              <input required placeholder="Titulo" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
              {bookForm.authors.map((author, index) => (
                <input
                  required={index === 0}
                  key={index}
                  placeholder={index === 0 ? "Autor principal" : "Otro autor"}
                  value={author}
                  onChange={(e) => updateAuthor(index, e.target.value)}
                />
              ))}
              <button type="button" className="ghost" onClick={() => setBookForm({ ...bookForm, authors: [...bookForm.authors, ""] })}>
                <Plus size={16} /> Otro autor
              </button>
              <div className="two-cols">
                <input placeholder="ISBN 13" value={bookForm.isbn13} onChange={(e) => setBookForm({ ...bookForm, isbn13: e.target.value })} />
                <input placeholder="Año" type="number" value={bookForm.publicationYear} onChange={(e) => setBookForm({ ...bookForm, publicationYear: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <input placeholder="Editorial" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} />
              <div className="two-cols">
                <input placeholder="Genero libre" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })} />
                <input placeholder="Paginas" type="number" value={bookForm.pageCount} onChange={(e) => setBookForm({ ...bookForm, pageCount: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <div className="two-cols">
                <select
                  value={bookForm.genreId}
                  onChange={(e) => setBookForm({ ...bookForm, genreId: e.target.value, subgenreId: "" })}
                >
                  <option value="">Genero principal</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>
                      {genre.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bookForm.subgenreId}
                  onChange={(e) => setBookForm({ ...bookForm, subgenreId: e.target.value })}
                  disabled={!bookForm.genreId}
                >
                  <option value="">Subgenero</option>
                  {selectedBookSubgenres.map((subgenre) => (
                    <option key={subgenre.id} value={subgenre.id}>
                      {subgenre.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="ghost" onClick={classifyFormBook} disabled={isClassifying || !bookForm.title.trim()}>
                <Sparkles size={16} /> {isClassifying ? "Clasificando..." : "Clasificar con IA"}
              </button>
              {(bookForm.deweyCode || bookForm.lcCode || bookForm.customTags?.length) && (
                <div className="classification-summary">
                  {bookForm.deweyCode && <span>DDC {bookForm.deweyCode}</span>}
                  {bookForm.lcCode && <span>LC {bookForm.lcCode}</span>}
                  {bookForm.customTags?.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              )}
              {classificationDraft.suggestedGenre && (
                <div className="ai-genre-suggestion media">
                  <div>
                    <span className="suggestion-badge">{classificationDraft.genreConfidence ?? "IA"}</span>
                    <strong>
                      {classificationDraft.suggestedGenre}
                      {classificationDraft.suggestedSubgenre ? ` / ${classificationDraft.suggestedSubgenre}` : ""}
                    </strong>
                  </div>
                  {classificationDraft.genreReason && <p>{classificationDraft.genreReason}</p>}
                </div>
              )}
              {deweyGenreSuggestion && (
                <div className={`ai-genre-suggestion ${deweyGenreSuggestion.confianza}`}>
                  <div>
                    <span className="suggestion-badge">
                      {deweyGenreSuggestion.confianza === "alta" ? "Alta" : deweyGenreSuggestion.confianza === "media" ? "Sugerido" : "Confirmar"}
                    </span>
                    <strong>
                      {deweyGenreSuggestion.genero_principal}
                      {deweyGenreSuggestion.subgenero ? ` / ${deweyGenreSuggestion.subgenero}` : ""}
                    </strong>
                  </div>
                  <p>{deweyGenreSuggestion.razon}</p>
                  {!deweyGenreSuggestion.genreId && (
                    <small>Este genero aun no existe en tu lista. Puedes crearlo en Estanterias o usarlo como genero libre.</small>
                  )}
                  <button type="button" className="ghost" onClick={applyDeweyGenreSuggestion}>
                    <Check size={15} /> Usar sugerencia
                  </button>
                </div>
              )}
              <input
                placeholder="Genero Dewey/API sin procesar"
                value={bookForm.deweyGenreRaw}
                onChange={(e) => setBookForm({ ...bookForm, deweyGenreRaw: e.target.value })}
              />
              <input placeholder="URL de portada" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })} />
              <textarea placeholder="Sinopsis" value={bookForm.synopsis} onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })} />
              <div className="two-cols">
                <select value={bookForm.readingStatus} onChange={(e) => setBookForm({ ...bookForm, readingStatus: e.target.value as ReadingStatus })}>
                  <option value="SIN_ESTADO">Sin estado</option>
                  <option value="LEIDO">Leido</option>
                  <option value="POR_LEER">Por leer</option>
                </select>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={bookForm.isReference}
                    onChange={(e) => setBookForm({ ...bookForm, isReference: e.target.checked })}
                  />
                  Referencia
                </label>
              </div>
              <select value={bookForm.shelfId} onChange={(e) => setBookForm({ ...bookForm, shelfId: e.target.value, shelfSectionId: "" })}>
                <option value="">Sin estanteria</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
              <select value={bookForm.shelfSectionId} onChange={(e) => setBookForm({ ...bookForm, shelfSectionId: e.target.value })}>
                <option value="">Sin repisa</option>
                {selectedShelf?.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              {selectedSectionGenreMismatch && (
                <div className="notice warning">
                  Esta repisa es de {selectedShelfSection?.genreRef?.name}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual si quieres ubicarlo ahi.
                </div>
              )}
              <div className="inline-label-tools">
                <div className="two-cols">
                  <select
                    value={labelSystem}
                    onChange={(event) => {
                      const system = event.target.value as "DEWEY" | "LC" | "PROPIA";
                      const serial = generateLabelSerialFromForm(system);
                      setLabelSystem(system);
                      setLabelSerialDraft(serial);
                      setBookForm({ ...bookForm, labelSystem: system, labelSerial: serial });
                    }}
                  >
                    <option value="DEWEY">Tejuelo Dewey</option>
                    <option value="LC">Tejuelo LC</option>
                    <option value="PROPIA">Tejuelo propio</option>
                  </select>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const serial = generateLabelSerialFromForm();
                      setLabelSerialDraft(serial);
                      setBookForm({ ...bookForm, labelSerial: serial, labelSystem });
                    }}
                  >
                    <Printer size={16} /> Generar tejuelo
                  </button>
                </div>
                <textarea
                  placeholder="Seriado del tejuelo"
                  value={labelSerialDraft || bookForm.labelSerial || ""}
                  onChange={(event) => {
                    setLabelSerialDraft(event.target.value);
                    setBookForm({ ...bookForm, labelSerial: event.target.value });
                  }}
                />
                <div className="label-preview">{labelSerialDraft || bookForm.labelSerial || generateLabelSerialFromForm()}</div>
              </div>
              <button className="primary" type="submit">
                <Check size={17} /> {editingBookId ? "Actualizar libro" : "Guardar libro"}
              </button>
              {editingBookId && (
                <button type="button" className="ghost" onClick={cancelEditBook}>
                  Cancelar edicion
                </button>
              )}
            </form>
          </details>

          <details
            className="panel-section classification-panel drawer-section"
            open={openToolSections.includes("classification")}
            onToggle={(event) => setToolSection("classification", event.currentTarget.open)}
          >
            <summary>
              <Sparkles size={18} /> Clasificacion con IA
            </summary>
            <div className="stack-form">
              <button type="button" className="ghost" onClick={() => openClassificationAssistant()}>
                <FileText size={16} /> Usar libro del formulario
              </button>
              <p className="helper-text">
                {classificationBook ? `Libro seleccionado: ${classificationBook.title}` : "Libro seleccionado: formulario de ingreso"}
              </p>
              <button type="button" className="primary" onClick={suggestClassification} disabled={isClassifying}>
                <Sparkles size={17} /> {isClassifying ? "Consultando..." : "Sugerir con IA"}
              </button>
              <div className="two-cols">
                <input
                  placeholder="Codigo Dewey"
                  value={classificationDraft.deweyCode ?? ""}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyCode: event.target.value })}
                />
                <input
                  placeholder="Signatura LC"
                  value={classificationDraft.lcCode ?? ""}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, lcCode: event.target.value })}
                />
              </div>
              <textarea
                placeholder="Jerarquia Dewey, una linea por nivel"
                value={classificationDraft.deweyHierarchy.join("\n")}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyHierarchy: splitLines(event.target.value) })}
              />
              <textarea
                placeholder="Explicacion Dewey"
                value={classificationDraft.deweyExplanation ?? ""}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyExplanation: event.target.value })}
              />
              <textarea
                placeholder="Jerarquia LC, una linea por nivel"
                value={classificationDraft.lcHierarchy.join("\n")}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, lcHierarchy: splitLines(event.target.value) })}
              />
              <textarea
                placeholder="Explicacion LC"
                value={classificationDraft.lcExplanation ?? ""}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, lcExplanation: event.target.value })}
              />
              <label className="tag-input">
                <Tags size={16} />
                <input
                  placeholder="Etiquetas separadas por coma"
                  value={classificationDraft.customTags.join(", ")}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, customTags: splitTags(event.target.value) })}
                />
              </label>
              <button type="button" className="primary" onClick={acceptClassification}>
                <Save size={17} /> Aceptar y guardar
              </button>
            </div>
          </details>

          <details
            className="panel-section label-panel drawer-section"
            open={openToolSections.includes("labels")}
            onToggle={(event) => setToolSection("labels", event.currentTarget.open)}
          >
            <summary>
              <Printer size={18} /> Generacion de tejuelos
            </summary>
            <div className="stack-form">
              <select
                value={labelBookId}
                onChange={(event) => {
                  const book = books.find((item) => item.id === event.target.value);
                  if (book) openLabelPanel(book);
                }}
              >
                <option value="">Elegir libro</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
              <div className="two-cols">
                <select
                  value={labelSystem}
                  onChange={(event) => {
                    const system = event.target.value as "DEWEY" | "LC" | "PROPIA";
                    setLabelSystem(system);
                    if (labelBook) setLabelSerialDraft(generateLabelSerial(labelBook, system));
                  }}
                >
                  <option value="DEWEY">Dewey</option>
                  <option value="LC">LC</option>
                  <option value="PROPIA">Propia</option>
                </select>
                <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as any)}>
                  <option value="PEQUENO">Pequeno 2 x 3 cm</option>
                  <option value="MEDIANO">Mediano 3 x 4 cm</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>
              <div className="two-cols">
                <select value={labelPageSize} onChange={(event) => setLabelPageSize(event.target.value as "letter" | "A4")}>
                  <option value="letter">Carta</option>
                  <option value="A4">A4</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={labelColumns}
                  onChange={(event) => setLabelColumns(Number(event.target.value))}
                  placeholder="Columnas"
                />
              </div>
              {labelSize === "PERSONALIZADO" && (
                <div className="two-cols">
                  <input type="number" min="1" step="0.1" value={labelWidth} onChange={(event) => setLabelWidth(Number(event.target.value))} />
                  <input type="number" min="1" step="0.1" value={labelHeight} onChange={(event) => setLabelHeight(Number(event.target.value))} />
                </div>
              )}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeShelfOnLabel}
                  onChange={(event) => {
                    setIncludeShelfOnLabel(event.target.checked);
                    if (labelBook) setLabelSerialDraft(generateLabelSerial(labelBook));
                  }}
                />
                Mostrar estanteria
              </label>
              <textarea
                placeholder="Seriado del tejuelo"
                value={labelSerialDraft}
                onChange={(event) => setLabelSerialDraft(event.target.value)}
              />
              <div className="label-preview">{labelSerialDraft || "SIN-CLAS\nAUT\nTIT"}</div>
              <div className="two-cols">
                <button type="button" className="primary" onClick={() => saveLabel()}>
                  <Save size={17} /> Guardar
                </button>
                <button type="button" className="ghost" onClick={() => labelBook && printLabels([labelBook])}>
                  <Printer size={17} /> PDF
                </button>
              </div>
              <div className="two-cols">
                <button type="button" className="ghost" onClick={() => downloadLabelPng()}>
                  <ImageIcon size={17} /> PNG
                </button>
                <button type="button" className="ghost" onClick={() => printLabels(selectedBooks)}>
                  <Printer size={17} /> Lote ({selectedBooks.length})
                </button>
              </div>
            </div>
          </details>

          {loanForm.bookId && (
            <section className="panel-section accent">
              <h2>Registrar prestamo</h2>
              <form onSubmit={submitLoan} className="stack-form">
                <input required placeholder="Prestado a" value={loanForm.borrowerName} onChange={(e) => setLoanForm({ ...loanForm, borrowerName: e.target.value })} />
                <input placeholder="Contacto" value={loanForm.borrowerContact} onChange={(e) => setLoanForm({ ...loanForm, borrowerContact: e.target.value })} />
                <input type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm({ ...loanForm, dueAt: e.target.value })} />
                <textarea placeholder="Notas" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} />
                <button className="primary" type="submit">
                  <Send size={17} /> Registrar
                </button>
              </form>
            </section>
          )}

          <details
            className="panel-section drawer-section locations-panel"
            open={openToolSections.includes("locations")}
            onToggle={(event) => setToolSection("locations", event.currentTarget.open)}
          >
            <summary>
              <Library size={18} /> Estanterias
            </summary>
            <form onSubmit={submitGenre} className="stack-form compact">
              <div className="two-cols">
                <input required placeholder="Genero" value={genreForm.name} onChange={(e) => setGenreForm({ ...genreForm, name: e.target.value })} />
                <input type="color" value={genreForm.color} onChange={(e) => setGenreForm({ ...genreForm, color: e.target.value })} />
              </div>
              <input placeholder="Icono Tabler (ej. ti-book)" value={genreForm.icon} onChange={(e) => setGenreForm({ ...genreForm, icon: e.target.value })} />
              <button className="primary" type="submit">{editingGenreId ? "Actualizar genero" : "Crear genero"}</button>
              {editingGenreId && (
                <button type="button" className="ghost" onClick={() => { setEditingGenreId(""); setGenreForm({ name: "", color: "#461e60", icon: "ti-book" }); }}>
                  Cancelar
                </button>
              )}
            </form>
            <form onSubmit={submitSubgenre} className="stack-form compact">
              <select required value={subgenreForm.genreId} onChange={(e) => setSubgenreForm({ ...subgenreForm, genreId: e.target.value })}>
                <option value="">Genero para subgenero</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
              <input required placeholder="Subgenero" value={subgenreForm.name} onChange={(e) => setSubgenreForm({ ...subgenreForm, name: e.target.value })} />
              <button className="ghost" type="submit">{editingSubgenreId ? "Actualizar subgenero" : "Crear subgenero"}</button>
            </form>
            <div className="genre-list">
              {genres.map((genre) => (
                <div key={genre.id} className="genre-row">
                  <div className="genre-title">
                    <span className="genre-color" style={{ background: genre.color }} />
                    <strong>{genre.name}</strong>
                    <small>{genre.icon}</small>
                  </div>
                  <div className="genre-actions">
                    <button type="button" onClick={() => { setEditingGenreId(genre.id); setGenreForm({ name: genre.name, color: genre.color, icon: genre.icon }); }}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="danger-soft" onClick={() => deleteGenre(genre)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {genre.subgenres.length > 0 && (
                    <div className="subgenre-list">
                      {genre.subgenres.map((subgenre) => (
                        <span key={subgenre.id} className="subgenre-pill">
                          {subgenre.name}
                          <button type="button" onClick={() => { setEditingSubgenreId(subgenre.id); setSubgenreForm({ genreId: genre.id, name: subgenre.name }); }}>
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={() => deleteSubgenre(subgenre.id, subgenre.name)}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={submitShelf} className="stack-form compact">
              <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
              <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
              <input type="number" min="1" placeholder="Capacidad de libros" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
              <button className="primary" type="submit">{editingShelfId ? "Actualizar estanteria" : "Crear estanteria"}</button>
              {editingShelfId && (
                <button type="button" className="ghost" onClick={() => { setEditingShelfId(""); setShelfForm({ name: "", homeLocation: "", description: "", mapX: 80, mapY: 80, mapWidth: 130, mapHeight: 72, capacity: 40 }); }}>
                  Cancelar
                </button>
              )}
            </form>
            <form onSubmit={submitSection} className="stack-form compact">
              <select required value={sectionForm.shelfId} onChange={(e) => setSectionForm({ ...sectionForm, shelfId: e.target.value })}>
                <option value="">Elegir estanteria</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
              <div className="two-cols">
                <input required placeholder="Repisa" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
                <input required type="number" min="1" value={sectionForm.position} onChange={(e) => setSectionForm({ ...sectionForm, position: Number(e.target.value) })} />
              </div>
              <select value={sectionForm.genreId} onChange={(e) => setSectionForm({ ...sectionForm, genreId: e.target.value })}>
                <option value="">Sin genero dedicado</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
              <button className="ghost" type="submit">{editingSectionId ? "Actualizar repisa" : "Crear repisa"}</button>
              {editingSectionId && (
                <button type="button" className="ghost" onClick={() => { setEditingSectionId(""); setSectionForm({ shelfId: "", name: "", position: 1, genreId: "" }); }}>
                  Cancelar
                </button>
              )}
            </form>
            <div className="shelf-list">
              {shelves.map((shelf) => (
                <div key={shelf.id} className="shelf-row">
                  <div className="shelf-row-header">
                    <div>
                      <strong>{shelf.name}</strong>
                      <span>{shelf.homeLocation} · {shelf._count?.books ?? 0} libros</span>
                    </div>
                    <button type="button" className="icon-menu" onClick={() => setOpenShelfMenuId(openShelfMenuId === shelf.id ? "" : shelf.id)} title="Menu">
                      <Menu size={17} />
                    </button>
                  </div>
                  {openShelfMenuId === shelf.id && (
                    <div className="shelf-actions">
                      <button type="button" onClick={() => editShelfFromMap(shelf)}>
                        <Pencil size={15} /> Editar
                      </button>
                      <button type="button" onClick={() => printLabels(books.filter((book) => book.shelf?.id === shelf.id))}>
                        <Printer size={15} /> Imprimir
                      </button>
                      <button type="button" className="danger-soft" onClick={() => deleteShelf(shelf)}>
                        <Trash2 size={15} /> Eliminar
                      </button>
                    </div>
                  )}
                  {shelf.sections.length > 0 && (
                    <div className="section-list">
                      {shelf.sections.map((section) => (
                        <div key={section.id} className="section-row">
                          <span>
                            {section.name}
                            {section.genreRef ? ` · ${section.genreRef.name}` : ""}
                          </span>
                          <div>
                            <button type="button" onClick={() => { setEditingSectionId(section.id); setSectionForm({ shelfId: shelf.id, name: section.name, position: section.position, genreId: section.genreId ?? "" }); }}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="danger-soft" onClick={() => deleteSection(section.id, section.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </aside>
      </main>
    </div>
  );
}
